import { toPaletteBytes } from '@8f4e/editor-palette';
import type { EditorLoadingRegistry, EventDispatcher, State } from '@8f4e/editor-state-types';
import loadFontAtlas, { DEFAULT_FONT, type Font, type FontAtlas } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import type { Engine } from 'glugglugglug';
import { subscribeToAppearance, updateGridSize } from './appearance';
import { getConfiguredFont, getConfiguredPalette } from './config';
import { DrawContext } from './drawContext';
import drawCodeBlocks from './drawers/codeBlocks';
import { createEditorDrawerRegistry, type EditorDrawerHost } from './drawers/registry';
import BackgroundRenderer from './plugins/background';
import { createRenderGeometry } from './render-geometry';
import type { RenderLayerFrameContext } from './render-layers';
import type { MemoryViews } from './types';

export { type GlyphIds, textToGlyphIds } from '@8f4e/sprite-generator';
export { registerWebUiConfig } from './config';
export { DrawContext, type SpriteTarget } from './drawContext';
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
export { createRenderGeometry, type RenderedCodeBlock, type RenderGeometry } from './render-geometry';
export type {
	EditorRenderLayer,
	RenderLayerContext,
	RenderLayerFactory,
	RenderLayerFrameContext,
} from './render-layers';
export { createSpriteCell, type SpriteCell } from './spriteCell';
// Re-export types
export type { FontChangedEvent, MemoryViews } from './types';

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
	/** Per-editor font used when project configuration does not select one. Defaults to ibmvga8x16. */
	defaultFont?: Font;
	/** Startup project preparation may run alongside the initial font download. */
	initialProjectReady?: Promise<void>;
	drawers?: EditorDrawerHost;
	onRenderStats?: (stats: RenderStats) => void;
	renderStatsIntervalFrames?: number;
}

/** The sprite and render-hook API used by web-ui. Alternative engines can satisfy it structurally. */
export type WebUiRenderer = Pick<
	Engine,
	| 'gl'
	| 'hooks'
	| 'frameStats'
	| 'setPalette'
	| 'setSpriteAtlas'
	| 'drawSprite'
	| 'resize'
	| 'renderFrame'
	| 'releaseRenderingMemory'
	| 'restoreRenderingMemory'
	| 'destroy'
>;

/** Initializes web-ui and takes ownership of the supplied renderer, including on startup failure. */
export default async function init(
	store: StateManager<State>,
	events: EventDispatcher,
	engine: WebUiRenderer,
	memoryViews: MemoryViews,
	options: WebUiOptions
) {
	try {
		return await mount(store, events, engine, memoryViews, options);
	} catch (error) {
		engine.destroy();
		throw error;
	}
}

async function mount(
	store: StateManager<State>,
	events: EventDispatcher,
	engine: WebUiRenderer,
	memoryViews: MemoryViews,
	options: WebUiOptions
) {
	const state = store.getState();
	const defaultFont = options.defaultFont ?? DEFAULT_FONT;
	const [initialFontAtlas] = await Promise.all([loadFontAtlas(defaultFont), options.initialProjectReady]);
	const font = getConfiguredFont(state.editorConfig, defaultFont);
	const fontAtlas = font === defaultFont ? initialFontAtlas : await loadFontAtlas(font);
	const palette = getConfiguredPalette(state.editorConfig);
	updateGridSize(state, events, fontAtlas);
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
	let viewportWidth = engine.gl.drawingBufferWidth || state.viewport.width || 1;
	let viewportHeight = engine.gl.drawingBufferHeight || state.viewport.height || 1;
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
		throw error;
	}
	const unsubscribeAppearance = subscribeToAppearance(
		store,
		events,
		options.loading,
		installFontAtlas,
		palette => {
			const bytes = toPaletteBytes(palette);
			engine.setPalette(bytes);
			background.setPalette(bytes);
			renderLayers.loadPalette(palette);
		},
		defaultFont
	);
	let layerFrame: RenderLayerFrameContext;
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

	const geometry = createRenderGeometry();
	const drawFrame = () => {
		const renderGeometry = geometry.prepare(state);
		layerFrame = { state, memoryViews, renderGeometry };
		const canvasFrame = { draw, state, memoryViews, renderGeometry };
		drawers.drawCanvasBackground(canvasFrame);
		drawCodeBlocks(draw, state, memoryViews, drawers, renderGeometry);
		drawers.drawCanvas(canvasFrame);
		if (state.featureFlags.canvasOverlays) drawers.drawCanvasOverlays(canvasFrame);
		drawers.drawContextMenuOverlays(canvasFrame);
		drawers.drawModalOverlays(canvasFrame);
	};

	let renderingResourcesReleased = false;
	const releaseRenderingResources = () => {
		if (renderingResourcesReleased) {
			return;
		}

		renderLayers.releaseMemory();
		engine.releaseRenderingMemory();
		renderingResourcesReleased = true;
		engine.resize(1, 1);
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
		resize: (width: number, height: number) => {
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
