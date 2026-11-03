import { toPaletteBytes } from '@8f4e/editor-palette';
import { advanceViewportAnimation } from '@8f4e/editor-state';
import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import loadFontAtlas, { DEFAULT_FONT, type Font, type FontAtlas } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import { Engine } from 'glugglugglug';
import { subscribeToAppearance, updateGridSize } from './appearance';
import { getConfiguredFont, getConfiguredPalette } from './config';
import { DrawContext } from './drawContext';
import drawCodeBlocks from './drawers/codeBlocks';
import drawContextMenu from './drawers/contextMenu';
import drawDialog from './drawers/dialog';
import { createEditorDrawerRegistry, type EditorDrawerHost } from './drawers/registry';
import BackgroundRenderer from './plugins/background';
import type { MemoryViews } from './types';

export { registerWebUiConfig } from './config';
export { DrawContext } from './drawContext';
export type {
	CanvasOverlayDrawer,
	CanvasOverlayDrawerContext,
	CodeBlockDrawer,
	CodeBlockDrawerContext,
	EditorDrawerRegistry,
} from './drawers/registry';
export { createEditorDrawerRegistry } from './drawers/registry';
export { createProgram, prepareRenderPass, requireResource, requireUniform } from './plugins/webgl';
export type {
	EditorRenderLayer,
	RenderLayerContext,
	RenderLayerFactory,
	RenderLayerFrameContext,
} from './render-layers';
export { createSpriteCell, type SpriteCell } from './spriteCell';
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
	/** Startup project preparation may run alongside the initial font download. */
	initialProjectReady?: Promise<void>;
	drawers?: EditorDrawerHost;
	onRenderStats?: (stats: RenderStats) => void;
	renderStatsIntervalFrames?: number;
}

export default async function init(
	store: StateManager<State>,
	events: EventDispatcher,
	canvas: HTMLCanvasElement,
	memoryViews: MemoryViews,
	options: WebUiOptions = {}
): Promise<{
	resize: (width: number, height: number) => boolean;
	pauseRendering: () => void;
	releaseRenderingResources: () => void;
	resumeRendering: () => void;
	renderFrame: () => void;
	destroy: () => void;
}> {
	const state = store.getState();
	const [initialFontAtlas] = await Promise.all([loadFontAtlas(DEFAULT_FONT), options.initialProjectReady]);
	const font = getConfiguredFont(state.editorConfig);
	const fontAtlas = font === DEFAULT_FONT ? initialFontAtlas : await loadFontAtlas(font);
	const palette = getConfiguredPalette(state.editorConfig);
	updateGridSize(state, events, fontAtlas);
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

	installFontAtlas(fontAtlas, font);
	const drawers = options.drawers ?? createEditorDrawerRegistry();
	let renderLayers: ReturnType<EditorDrawerHost['attachRenderLayers']>;
	try {
		renderLayers = drawers.attachRenderLayers({ gl: engine.gl, palette });
	} catch (error) {
		background.destroy();
		engine.destroy();
		throw error;
	}
	const unsubscribeAppearance = subscribeToAppearance(store, events, installFontAtlas, palette => {
		const bytes = toPaletteBytes(palette);
		engine.setPalette(bytes);
		background.setPalette(bytes);
		renderLayers.loadPalette(palette);
	});
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

	const drawFrame = () => {
		drawCodeBlocks(draw, state, memoryViews, drawers);
		drawContextMenu(draw, state);
		if (state.featureFlags.canvasOverlays) drawers.drawCanvasOverlays({ draw, state, memoryViews });
		drawDialog(draw, state);
	};

	let rendering = false;
	let renderingResourcesReleased = false;
	let animationFrameRequest: number | null = null;
	const renderFrame = (frameTime = performance.now()) => {
		advanceViewportAnimation(state, frameTime, events);
		engine.renderFrame(drawFrame);
	};
	const renderNextFrame = (frameTime = performance.now()) => {
		animationFrameRequest = null;
		if (!rendering) {
			return;
		}

		try {
			renderFrame(frameTime);
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
		pauseRendering,
		releaseRenderingResources,
		resumeRendering,
		renderFrame: () => {
			restoreRenderingResources();
			renderFrame();
		},
		destroy: () => {
			pauseRendering();
			unsubscribeAppearance();
			try {
				renderLayers.destroy();
			} finally {
				background.destroy();
				engine.destroy();
			}
		},
	};
}
