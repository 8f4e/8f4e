import type { EditorLoadingRegistry, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { Font } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import { createCameraController } from './camera/cameraController';
import { createFontAtlasController, loadInitialFontAtlas } from './font-and-palette/fontAtlas';
import { createPaletteController } from './font-and-palette/palette';
import { createFrameRenderer } from './frame/drawFrame';
import { createFrameStats, type RenderStats } from './frame/frameStats';
import type { EditorRenderHost } from './frame/renderRegistry';
import type { MemoryViews } from './memoryViews';
import { createResourceLifecycle } from './webgl/resourceLifecycle';
import type { SpriteEngine } from './webgl/spriteEngine';

export interface WebUiOptions {
	loading: EditorLoadingRegistry;
	/** Per-editor font used when project configuration does not select one. Defaults to ibmvga8x16. */
	defaultFont?: Font;
	/** Read the host's live motion preference without creating browser listeners in web-ui. */
	prefersReducedMotion?: () => boolean;
	renderRegistry: EditorRenderHost;
	onRenderStats?: (stats: RenderStats) => void;
}

/** Initializes web-ui and takes ownership of the supplied sprite engine, including on startup failure. */
export default async function initializeWebUi(
	store: StateManager<State>,
	events: EventDispatcher,
	engine: SpriteEngine,
	memoryViews: MemoryViews,
	options: WebUiOptions
) {
	try {
		const state = store.getState();
		const initialFont = await loadInitialFontAtlas(state, options.defaultFont);
		const palette = createPaletteController(store, engine);
		const stats = createFrameStats(engine, options.onRenderStats);
		const { renderRegistry } = options;
		const fonts = createFontAtlasController(store, events, options.loading, engine, initialFont, options.defaultFont);
		const renderLayers = renderRegistry.attachRenderLayers({ gl: engine.gl, palette: palette.initial });
		const camera = createCameraController(store, events, options.prefersReducedMotion);
		const unsubscribeFont = fonts.subscribe();
		const unsubscribePalette = palette.subscribe(renderLayers);
		const frame = createFrameRenderer(state, engine, fonts.draw, memoryViews, renderRegistry, renderLayers, stats);
		const resources = createResourceLifecycle(engine, renderLayers, state.viewport);

		return {
			resize: resources.resize,
			releaseRenderingResources: resources.release,
			resetRenderStats: stats.reset,
			renderFrame: (frameTime = performance.now()) => {
				resources.restore();
				const { viewport, suppressBlockOffsets } = camera.sample(frameTime);
				frame.draw(frameTime, viewport, suppressBlockOffsets);
			},
			destroy: () => {
				camera.destroy();
				unsubscribeFont();
				unsubscribePalette();
				frame.destroy();
				try {
					renderLayers.destroy();
				} finally {
					engine.destroy();
				}
			},
		};
	} catch (error) {
		engine.destroy();
		throw error;
	}
}
