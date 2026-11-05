import { toPaletteBytes } from '@8f4e/editor-palette';
import type { EditorLoadingRegistry, EventDispatcher, State } from '@8f4e/editor-state-types';
import loadFontAtlas, { DEFAULT_FONT, type Font, type FontAtlas } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import { Engine } from 'glugglugglug';
import { subscribeToAppearance, updateGridSize } from './appearance';
import { getConfiguredFont, getConfiguredPalette } from './config';
import { DrawContext } from './drawContext';
import drawCodeBlocks from './drawers/codeBlocks';
import { createEditorDrawerRegistry, type EditorDrawerHost } from './drawers/registry';
import BackgroundRenderer from './plugins/background';
import type { MemoryViews } from './types';

export { registerWebUiConfig } from './config';
export { DrawContext } from './drawContext';
export type {
	CanvasDrawer,
	CanvasDrawerContext,
	CodeBlockDrawer,
	CodeBlockDrawerContext,
	EditorDrawerRegistry,
	OffscreenCodeBlockDrawer,
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
	loading: EditorLoadingRegistry;
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
	options: WebUiOptions
): Promise<{
	resize: (width: number, height: number) => boolean;
	releaseRenderingResources: () => void;
	resetRenderStats: () => void;
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
	const unsubscribeAppearance = subscribeToAppearance(store, events, options.loading, installFontAtlas, palette => {
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
		drawers.drawCanvasBackground({ draw, state, memoryViews });
		drawCodeBlocks(draw, state, memoryViews, drawers);
		drawers.drawCanvas({ draw, state, memoryViews });
		if (state.featureFlags.canvasOverlays) drawers.drawCanvasOverlays({ draw, state, memoryViews });
		drawers.drawModalOverlays({ draw, state, memoryViews });
	};

	let renderingResourcesReleased = false;
	const releaseRenderingResources = () => {
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
	const resetRenderStats = () => {
		statsSampleStartTime = performance.now();
		statsSampleStartFrameCount = renderedFrameCount;
	};

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
		releaseRenderingResources,
		resetRenderStats,
		renderFrame: () => {
			restoreRenderingResources();
			engine.renderFrame(drawFrame);
		},
		destroy: () => {
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
