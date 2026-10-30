import { type ResolvedPalette, toPaletteBytes } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import { DEFAULT_FONT, type Font, type FontAtlas } from '@8f4e/sprite-generator';
import type { WebUiRenderDataSource } from '@8f4e/web-ui-render-projection';
import { Engine } from 'glugglugglug';
import { DrawContext } from './drawContext';
import drawCodeBlocks from './drawers/codeBlocks';
import drawContextMenu from './drawers/contextMenu';
import drawDialog from './drawers/dialog';
import drawModeOverlay from './drawers/modeOverlay';
import { type CodeBlockDrawerRegistry, createCodeBlockDrawerRegistry } from './drawers/registry';
import { createWasmOverlayTextureDrawer, type WasmOverlayTextureOptions } from './drawers/wasmOverlayTexture';
import BackgroundRenderer from './plugins/background';
import { RgbaTextureLayer } from './plugins/rgba-texture-layer';
import type { MemoryViews } from './types';

export { DrawContext } from './drawContext';
export type { CodeBlockDrawer, CodeBlockDrawerContext, EditorDrawerRegistry } from './drawers/registry';
export { createCodeBlockDrawerRegistry } from './drawers/registry';
export { createProgram, prepareRenderPass, requireResource, requireUniform } from './plugins/webgl';
export type {
	EditorRenderLayer,
	RenderLayerContext,
	RenderLayerFactory,
	RenderLayerFrameContext,
} from './render-layers';
// Re-export types
export type { MemoryViews } from './types';

export interface RenderStats {
	timeToRenderMs: number;
	fps: number;
	frameBudgetMs: number;
	headroomMs: number;
	fpsCapacity: number;
	spriteCount: number;
	uploadedInstanceBytes: number;
}

export interface WebUiOptions {
	drawers?: CodeBlockDrawerRegistry;
	onRenderStats?: (stats: RenderStats) => void;
	renderStatsIntervalFrames?: number;
	overlayTexture?: WasmOverlayTextureOptions;
	getCodeBuffer?: () => Uint8Array;
	getMemory?: () => WebAssembly.Memory | null;
	instantiateOverlayTextureWasm?: (
		memory: WebAssembly.Memory,
		codeBuffer: Uint8Array
	) => Promise<WebAssembly.Exports> | WebAssembly.Exports;
}

export default async function init(
	state: State,
	renderData: WebUiRenderDataSource,
	canvas: HTMLCanvasElement,
	memoryViews: MemoryViews,
	fontAtlas: FontAtlas,
	palette: ResolvedPalette,
	options: WebUiOptions = {}
): Promise<{
	resize: (width: number, height: number) => boolean;
	loadFontAtlas: (fontAtlas: FontAtlas, font: Font) => void;
	loadPalette: (palette: ResolvedPalette) => void;
	pauseRendering: () => void;
	releaseRenderingResources: () => void;
	resumeRendering: () => void;
	renderFrame: () => void;
	setOverlayTexture: (overlayTexture: WasmOverlayTextureOptions | undefined) => void;
	destroy: () => void;
}> {
	const engine = new Engine(canvas);
	let frameStartedAt = performance.now();
	engine.hooks.preDraw.push(() => {
		frameStartedAt = performance.now();
	});
	const background = new BackgroundRenderer(engine);
	const draw = new DrawContext(engine, fontAtlas.grid.cellWidth);
	const paletteBytes = toPaletteBytes(palette);
	engine.setPalette(paletteBytes);
	background.setPalette(paletteBytes);
	const renderStatsIntervalFrames = Math.max(1, Math.floor(options.renderStatsIntervalFrames ?? 60));
	let viewportWidth = canvas.width;
	let viewportHeight = canvas.height;
	let renderedFrameCount = 0;
	let statsSampleStartFrameCount = 0;
	let statsSampleStartTime = performance.now();

	function installFontAtlas(atlas: FontAtlas, font: Font): void {
		engine.setSpriteAtlas(atlas.image, atlas.grid);
		background.setFont(font, atlas.grid);
		draw.setCharacterWidth(atlas.grid.cellWidth);
	}

	installFontAtlas(fontAtlas, state.editorConfig.font ?? DEFAULT_FONT);
	let renderLayers: ReturnType<CodeBlockDrawerRegistry['attachRenderLayers']>;
	try {
		renderLayers = (options.drawers ?? createCodeBlockDrawerRegistry()).attachRenderLayers({ gl: engine.gl, palette });
	} catch (error) {
		background.destroy();
		engine.destroy();
		throw error;
	}
	const layerFrame = { state, memoryViews };
	engine.hooks.postDraw.push(() => renderLayers.draw(layerFrame));

	function getSampledFps(): number {
		const now = performance.now();
		const elapsedMs = now - statsSampleStartTime;
		const sampledFrameCount = renderedFrameCount - statsSampleStartFrameCount;
		statsSampleStartTime = now;
		statsSampleStartFrameCount = renderedFrameCount;
		return elapsedMs > 0 ? Math.round((sampledFrameCount * 1000) / elapsedMs) : 0;
	}

	function emitRenderStats(timeToRenderMs: number): void {
		if (!options.onRenderStats) {
			return;
		}

		renderedFrameCount++;
		if (renderedFrameCount % renderStatsIntervalFrames !== 0) {
			return;
		}

		const fps = getSampledFps();
		const frameBudgetMs = fps > 0 ? 1000 / fps : 0;
		const headroomMs = frameBudgetMs > 0 ? frameBudgetMs - timeToRenderMs : 0;
		const fpsCapacity = timeToRenderMs > 0 ? Math.round(1000 / timeToRenderMs) : 0;
		options.onRenderStats({
			timeToRenderMs,
			fps,
			frameBudgetMs,
			headroomMs,
			fpsCapacity,
			spriteCount: engine.frameStats.spriteCount,
			uploadedInstanceBytes: engine.frameStats.uploadedInstanceBytes,
		});
	}

	const renderStatsHook = () => {
		emitRenderStats(performance.now() - frameStartedAt);
	};
	engine.hooks.postDraw.push(renderStatsHook);

	let overlayTexture = options.overlayTexture;
	let overlayTextureLayer: RgbaTextureLayer | undefined;
	let overlayTextureKey = '';

	function destroyOverlayTextureLayer(): void {
		overlayTextureLayer?.destroy();
		overlayTextureLayer = undefined;
		overlayTextureKey = '';
	}

	function keepRenderStatsHookLast(): void {
		const hookIndex = engine.hooks.postDraw.indexOf(renderStatsHook);
		if (hookIndex !== -1) {
			engine.hooks.postDraw.splice(hookIndex, 1);
			engine.hooks.postDraw.push(renderStatsHook);
		}
	}

	function syncWasmOverlayTexture(): void {
		const nextOverlayTextureKey = overlayTexture ? JSON.stringify(overlayTexture) : '';
		if (!overlayTexture || !options.getCodeBuffer || !options.getMemory) {
			destroyOverlayTextureLayer();
			return;
		}

		if (overlayTextureLayer && overlayTextureKey === nextOverlayTextureKey) {
			return;
		}

		destroyOverlayTextureLayer();
		const drawWasmOverlayTexture = createWasmOverlayTextureDrawer({
			state,
			memoryViews,
			overlayTexture,
			getCodeBuffer: options.getCodeBuffer,
			getMemory: options.getMemory,
			getViewportSize: () => ({ width: viewportWidth, height: viewportHeight }),
			instantiate: options.instantiateOverlayTextureWasm,
		});
		overlayTextureLayer = new RgbaTextureLayer(engine);
		overlayTextureLayer.setDrawCallback(layer => {
			drawWasmOverlayTexture(layer);
		});
		overlayTextureKey = nextOverlayTextureKey;
		keepRenderStatsHookLast();
	}

	function setOverlayTexture(nextOverlayTexture: WasmOverlayTextureOptions | undefined): void {
		overlayTexture = nextOverlayTexture;
		syncWasmOverlayTexture();
	}

	const drawFrame = () => {
		drawCodeBlocks(draw, state, memoryViews, renderData.getSnapshot(), options.drawers);
		drawContextMenu(draw, state);
		drawModeOverlay(draw, state);
		drawDialog(draw, state);
	};

	let rendering = false;
	let renderingResourcesReleased = false;
	let animationFrameRequest: number | null = null;
	const renderNextFrame = () => {
		animationFrameRequest = null;
		if (!rendering) {
			return;
		}

		try {
			engine.renderFrame(drawFrame);
		} catch (error) {
			rendering = false;
			throw error;
		}

		if (rendering) {
			animationFrameRequest = requestAnimationFrame(renderNextFrame);
		}
	};
	const pauseRendering = () => {
		if (!rendering) {
			return;
		}

		rendering = false;
		if (animationFrameRequest !== null) {
			cancelAnimationFrame(animationFrameRequest);
			animationFrameRequest = null;
		}
	};
	const releaseRenderingResources = () => {
		pauseRendering();
		if (renderingResourcesReleased) {
			return;
		}

		overlayTextureLayer?.releaseMemory();
		renderLayers.releaseMemory();
		engine.releaseRenderingMemory();
		renderingResourcesReleased = true;
		canvas.width = 1;
		canvas.height = 1;
	};
	const restoreRenderingResources = () => {
		if (!renderingResourcesReleased) {
			return;
		}

		engine.restoreRenderingMemory();
		engine.resize(viewportWidth, viewportHeight);
		renderingResourcesReleased = false;
	};
	const resumeRendering = () => {
		if (rendering) {
			return;
		}

		restoreRenderingResources();
		rendering = true;
		statsSampleStartTime = performance.now();
		statsSampleStartFrameCount = renderedFrameCount;
		renderNextFrame();
	};

	syncWasmOverlayTexture();
	resumeRendering();

	return {
		resize: (width, height) => {
			viewportWidth = width;
			viewportHeight = height;
			if (renderingResourcesReleased) {
				return false;
			}
			engine.resize(width, height);
			return true;
		},
		loadFontAtlas: installFontAtlas,
		loadPalette: palette => {
			const bytes = toPaletteBytes(palette);
			engine.setPalette(bytes);
			background.setPalette(bytes);
			renderLayers.loadPalette(palette);
		},
		pauseRendering,
		releaseRenderingResources,
		resumeRendering,
		setOverlayTexture,
		renderFrame: () => {
			restoreRenderingResources();
			engine.renderFrame(drawFrame);
		},
		destroy: () => {
			pauseRendering();
			try {
				renderLayers.destroy();
			} finally {
				background.destroy();
				destroyOverlayTextureLayer();
				engine.destroy();
			}
		},
	};
}
