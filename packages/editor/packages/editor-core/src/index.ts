import { resolvePalette } from '@8f4e/editor-palette';
import initState, {
	createEditorEditingHandle,
	type EditorEditingHandle,
	type EditorNavigationHandle,
	EMPTY_DEFAULT_PROJECT,
} from '@8f4e/editor-state';
import type { EditorConfigSchemaContributionRegistry, InfoRecord, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import loadFontAtlas from '@8f4e/sprite-generator';
import initView, {
	createEditorDrawerRegistry,
	type MemoryViews,
	type RenderStats,
	type WebUiOptions,
} from '@8f4e/web-ui';
import { createWebUiRenderProjection } from '@8f4e/web-ui-render-projection';

import { disposeAll } from './disposeAll';
import initEvents from './events';
import keyboardEvents from './events/keyboardEvents';
import pointerEvents from './events/pointerEvents';
import { createMemoryViewManager } from './memoryViewManager';
import { type EditorPlugin, installEditorPlugins } from './plugins';
import { createSpriteSheetManager } from './spriteSheetManager';
import {
	resolveWebUiOverlayConfig,
	WEB_UI_EDITOR_CONFIG_SCHEMA_CONTRIBUTION_ID,
	webUiEditorConfigSchemaContribution,
} from './webUiConfig';

export type {
	EditorEdit,
	EditorEditingHandle,
	EditorEditResult,
	EditorNavigationHandle,
} from '@8f4e/editor-state';
export {
	collectSchemaConfigPaths,
	createSchemaEditorConfigValidator,
	EditorEditingError,
	getEditorBlockId,
	getSchemaForConfigPath,
	parseSchemaConfigValue,
	resolveSchemaConfigRoot,
	validateSchemaConfigValue,
} from '@8f4e/editor-state';
// Re-export types that consumers might need
export type {
	CodeBlockGraphicData,
	CodeError,
	EditorConfig,
	EditorConfigSchemaContribution,
	EditorConfigSchemaContributionRegistry,
	EditorMenuItemContext,
	EditorMenuItemProvider,
	EditorMenuItemSlot,
	EditorMenuRegistry,
	EditorMode,
	FeatureFlags,
	FeatureFlagsConfig,
	JSONSchemaLike,
	MenuGenerator,
	Options,
	ParsedDirectiveRecord,
	State,
} from '@8f4e/editor-state-types';
export type { CodeBlockDrawer, CodeBlockDrawerContext, EditorDrawerRegistry } from '@8f4e/web-ui';
export type { EventDispatcher } from './events';
export type { EditorPlugin, EditorPluginContext } from './plugins';
// Re-export helper functions

/** Accepted program data needed by memory views and the renderer. */
export interface ProgramArtifacts {
	memoryRef: WebAssembly.Memory;
	codeBuffer: Uint8Array;
}

export interface Editor {
	editing: EditorEditingHandle;
	navigation: EditorNavigationHandle;
	resize: (width: number, height: number) => void;
	/** Render the current state immediately. */
	renderFrame: () => void;
	pauseRendering: () => void;
	/** Releases reloadable GPU resources and the canvas drawing buffer. */
	releaseRenderingResources: () => void;
	resumeRendering: () => void;
	getMemoryViews: () => MemoryViews;
	dispose: () => void;
	state: State;
}

export interface EditorOptions {
	/** Initial project content; defaults to an empty project. */
	initialProject?: ProjectObjectModel;
	/** Trusted plugins, installed before rendering, initialization, and initial project loading. */
	plugins?: readonly EditorPlugin[];
	/** Capture wheel gestures for viewport panning. Disable this for editors embedded in scrolling pages. */
	captureWheel?: boolean;
	featureFlags?: Partial<State['featureFlags']>;
	editorConfigSchemaContributions?: EditorConfigSchemaContributionRegistry;
	renderStatsIntervalFrames?: number;
	overlayTexture?: WebUiOptions['overlayTexture'];
}

interface CanvasSize {
	width: number;
	height: number;
}

function getCanvasDisplaySize(canvas: HTMLCanvasElement): CanvasSize | null {
	const width = Math.floor(canvas.clientWidth);
	const height = Math.floor(canvas.clientHeight);

	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return null;
	}

	return { width, height };
}

function toGraphicsInfoRecord(stats: RenderStats): InfoRecord {
	return {
		timeToRenderMs: stats.timeToRenderMs,
		fps: stats.fps,
		frameBudgetMs: stats.frameBudgetMs,
		headroomMs: stats.headroomMs,
		fpsCapacity: stats.fpsCapacity,
		spriteCount: stats.spriteCount,
		uploadedInstanceBytes: stats.uploadedInstanceBytes,
	};
}

export default async function init(canvas: HTMLCanvasElement, options: EditorOptions): Promise<Editor> {
	const cleanups: Array<() => void> = [];
	let beforeDispose = () => {};
	let disposed = false;
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		cleanups.push(beforeDispose);
		disposeAll(cleanups);
	};
	try {
		const initialTabIndex = canvas.tabIndex;
		const addedTabIndex = initialTabIndex < 0 && !canvas.hasAttribute('tabindex');
		if (addedTabIndex) {
			canvas.tabIndex = 0;
			cleanups.push(() => {
				if (canvas.tabIndex === 0) canvas.removeAttribute('tabindex');
			});
		}

		const { memoryViews, updateMemoryViews } = createMemoryViewManager(new ArrayBuffer(0));
		const events = initEvents();
		beforeDispose = () => events.dispatch('dispose');
		cleanups.push(() => events.dispose());
		let currentMemoryRef: WebAssembly.Memory | null = null;
		let currentCodeBuffer = new Uint8Array();
		const onCompilationSucceeded = (result: ProgramArtifacts) => {
			currentMemoryRef = result.memoryRef;
			updateMemoryViews(result.memoryRef);
			currentCodeBuffer = new Uint8Array(result.codeBuffer);
		};
		events.on('compilationSucceeded', onCompilationSucceeded);
		cleanups.push(() => events.off('compilationSucceeded', onCompilationSucceeded));
		let store: ReturnType<typeof initState>;
		let view: Awaited<ReturnType<typeof initView>>;
		const editorConfigSchemaContributions: EditorConfigSchemaContributionRegistry = {
			[WEB_UI_EDITOR_CONFIG_SCHEMA_CONTRIBUTION_ID]: webUiEditorConfigSchemaContribution,
			...options.editorConfigSchemaContributions,
		};

		store = initState(events, {
			...options,
			editorConfigSchemaContributions,
			callbacks: {
				getWordFromMemory: (allocationUnitAddress: number) => {
					return memoryViews.int32[allocationUnitAddress] || 0;
				},
				readClipboardText: async () => {
					return await navigator.clipboard.readText();
				},
				writeClipboardText: async (text: string) => {
					await navigator.clipboard.writeText(text);
				},
				requestAnimationFrame: callback => window.requestAnimationFrame(callback),
				cancelAnimationFrame: id => window.cancelAnimationFrame(id),
			},
		});
		cleanups.push(() => store.dispose());
		const editing = createEditorEditingHandle(store, events);
		cleanups.push(editing.dispose);
		const drawers = createEditorDrawerRegistry();
		cleanups.push(
			installEditorPlugins(options.plugins ?? [], {
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				drawers,
			})
		);
		const state = store.getState();
		cleanups.push(pointerEvents(canvas, events, state, options.captureWheel));
		cleanups.push(keyboardEvents(canvas, events, store));

		// Load the selected font before initializing the view.
		const fontAtlas = await loadFontAtlas(state.editorConfig.font);
		state.viewport.hGrid = fontAtlas.grid.cellHeight;
		state.viewport.vGrid = fontAtlas.grid.cellWidth;

		const renderProjection = createWebUiRenderProjection(store, events);
		cleanups.push(() => renderProjection.dispose());
		const getOverlayTexture = () => resolveWebUiOverlayConfig(state) ?? options.overlayTexture;

		view = await initView(
			state,
			renderProjection,
			canvas,
			memoryViews,
			fontAtlas,
			resolvePalette(state.editorConfig.color),
			{
				drawers,
				renderStatsIntervalFrames: options.renderStatsIntervalFrames,
				overlayTexture: getOverlayTexture(),
				getCodeBuffer: () => currentCodeBuffer,
				getMemory: () => currentMemoryRef,
				onRenderStats: stats => {
					store.set('info.graphics', toGraphicsInfoRecord(stats));
				},
			}
		);
		cleanups.push(() => view.destroy());
		const syncOverlayTexture = () => {
			view.setOverlayTexture(getOverlayTexture());
		};
		store.subscribe('editorConfig.webUI', syncOverlayTexture);
		cleanups.push(() => store.unsubscribe('editorConfig.webUI', syncOverlayTexture));
		syncOverlayTexture();

		cleanups.push(createSpriteSheetManager(store, view, events));

		let currentCanvasSize: CanvasSize | null = null;
		const resize = (width: number, height: number) => {
			events.dispatch('resize', { canvasWidth: width, canvasHeight: height });
			const resized = view.resize(width, height);
			currentCanvasSize = { width, height };
			if (resized) {
				view.renderFrame();
			}
		};
		const initialCanvasSize = getCanvasDisplaySize(canvas) ?? {
			width: canvas.width,
			height: canvas.height,
		};
		const browserWindow = canvas.ownerDocument?.defaultView ?? globalThis.window;
		const resizeObserver = browserWindow?.ResizeObserver
			? new browserWindow.ResizeObserver(() => {
					const size = getCanvasDisplaySize(canvas);
					if (!size || (size.width === currentCanvasSize?.width && size.height === currentCanvasSize.height)) {
						return;
					}

					resize(size.width, size.height);
				})
			: null;
		if (resizeObserver) cleanups.push(() => resizeObserver.disconnect());

		resize(initialCanvasSize.width, initialCanvasSize.height);
		resizeObserver?.observe(canvas);
		events.dispatch('loadProject', { project: options.initialProject ?? EMPTY_DEFAULT_PROJECT });
		events.dispatch('init');

		return {
			editing: editing.handle,
			navigation: editing.navigation,
			resize,
			renderFrame: () => view.renderFrame(),
			pauseRendering: () => view.pauseRendering(),
			releaseRenderingResources: () => view.releaseRenderingResources(),
			resumeRendering: () => view.resumeRendering(),
			getMemoryViews: () => memoryViews,
			dispose,
			state,
		};
	} catch (error) {
		dispose();
		throw error;
	}
}
