import { toPaletteBytes } from '@8f4e/editor-palette';
import {
	type EditorLoadingRegistry,
	type EventDispatcher,
	INPUT_LAYERS,
	type InternalPointerEvent,
	type State,
} from '@8f4e/editor-state-types';
import loadFontAtlas, { DEFAULT_FONT, type Font, type FontAtlas } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import type { Engine } from 'glugglugglug';
import { subscribeToAppearance, updateGridSize } from './appearance';
import { getAppearanceFont, getConfiguredPalette } from './config';
import { DrawContext } from './drawContext';
import drawCodeBlocks from './drawers/codeBlocks';
import { createEditorDrawerRegistry, type EditorDrawerHost } from './drawers/registry';
import { createRenderGeometry } from './render-geometry';
import type { RenderLayerFrameContext } from './render-layers';
import type { MemoryViews } from './types';
import { createViewportTransition } from './viewport-transition';
import { removeHook } from './webgl';

export { type GlyphIds, textToGlyphIds } from '@8f4e/sprite-generator';
export { getAppearanceFont, registerWebUiConfig } from './config';
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
export type {
	CodeBlockOffsetResolver,
	CodeBlockPositionEffect,
	RenderedCodeBlock,
	RenderGeometry,
} from './render-geometry';
export type {
	EditorRenderLayer,
	RenderLayerContext,
	RenderLayerFactory,
	RenderLayerFrameContext,
	RenderLayerStage,
} from './render-layers';
export { createSpriteCell, type SpriteCell } from './spriteCell';
// Re-export types
export type { FontChangedEvent, MemoryViews } from './types';
export { createProgram, prepareRenderPass, requireResource, requireUniform } from './webgl';

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
	/** Read the host's live motion preference without creating browser listeners in web-ui. */
	prefersReducedMotion?: () => boolean;
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
	const font = getAppearanceFont(state, defaultFont);
	const fontAtlas = await loadFontAtlas(font);
	const palette = getConfiguredPalette(state.editorConfig);
	const presentedViewport = { ...state.viewport };
	const prefersReducedMotion = options.prefersReducedMotion ?? (() => false);
	const draw = new DrawContext(engine, fontAtlas.grid.cellWidth);
	engine.setPalette(toPaletteBytes(palette));
	const renderStatsIntervalFrames = Math.max(1, Math.floor(options.renderStatsIntervalFrames ?? 60));
	let viewportWidth = engine.gl.drawingBufferWidth || state.viewport.width || 1;
	let viewportHeight = engine.gl.drawingBufferHeight || state.viewport.height || 1;
	let renderedFrameCount = 0;
	let statsSampleStartFrameCount = 0;
	let statsSampleStartTime = performance.now();

	function installFontAtlas(atlas: FontAtlas): void {
		engine.setSpriteAtlas(atlas.image, atlas.grid);
		draw.setCharacterWidth(atlas.grid.cellWidth);
	}

	const drawers = options.drawers ?? createEditorDrawerRegistry();
	installFontAtlas(fontAtlas);
	updateGridSize(state, events, fontAtlas);
	Object.assign(presentedViewport, state.viewport);
	const renderLayers = drawers.attachRenderLayers({ gl: engine.gl, palette });
	const viewportTransition = createViewportTransition(state.viewport);
	const { onViewportChanged, reset: resetViewportTransition } = viewportTransition;
	const guardPointerPress = (event: InternalPointerEvent) => {
		if (viewportTransition.isTransitioning() && !prefersReducedMotion()) event.stopPropagation = true;
	};
	const inputGate = { capture: true, layer: INPUT_LAYERS.modalOverlay + 1 };
	events.on('viewportChanged', onViewportChanged);
	store.subscribe('project.activeLevel', resetViewportTransition);
	events.on('gridSizeChanged', resetViewportTransition);
	events.on('pointerdown', guardPointerPress, inputGate);
	events.on('contextmenu', guardPointerPress, inputGate);
	const unsubscribeAppearance = subscribeToAppearance(
		store,
		events,
		options.loading,
		installFontAtlas,
		palette => {
			engine.setPalette(toPaletteBytes(palette));
			renderLayers.loadPalette(palette);
		},
		defaultFont
	);
	let layerFrame: RenderLayerFrameContext;
	const beforeSprites = () => renderLayers.draw('beforeSprites', layerFrame);
	const afterSprites = () => renderLayers.draw('afterSprites', layerFrame);
	engine.hooks.preDraw.push(beforeSprites);
	engine.hooks.postDraw.push(afterSprites);

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

	const geometry = createRenderGeometry();
	const drawFrame = () => {
		const { renderGeometry } = layerFrame;
		const canvasFrame = { draw, ...layerFrame };
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
		renderFrame: (frameTime = performance.now()) => {
			restoreRenderingResources();
			const camera = viewportTransition.sample(state.viewport, frameTime, prefersReducedMotion());
			Object.assign(presentedViewport, state.viewport);
			presentedViewport.x = camera.x;
			presentedViewport.y = camera.y;
			const frameStartedAt = performance.now();
			const offsets = drawers.prepareCodeBlockOffsets(state, frameTime, camera.suppressBlockOffsets);
			const renderGeometry = geometry.prepare(state, offsets, presentedViewport);
			layerFrame = { state, viewport: presentedViewport, memoryViews, renderGeometry };
			engine.renderFrame(drawFrame);
			emitRenderStats(performance.now() - frameStartedAt);
		},
		destroy: () => {
			events.off('viewportChanged', onViewportChanged);
			store.unsubscribe('project.activeLevel', resetViewportTransition);
			events.off('gridSizeChanged', resetViewportTransition);
			events.off('pointerdown', guardPointerPress);
			events.off('contextmenu', guardPointerPress);
			unsubscribeAppearance();
			removeHook(engine.hooks.preDraw, beforeSprites);
			removeHook(engine.hooks.postDraw, afterSprites);
			try {
				renderLayers.destroy();
			} finally {
				engine.destroy();
			}
		},
	};
}
