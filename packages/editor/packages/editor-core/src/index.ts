import initState, {
	createEditorEditingHandle,
	type EditorEditingHandle,
	type EditorNavigationHandle,
	EMPTY_DEFAULT_PROJECT,
} from '@8f4e/editor-state';
import type { EditorConfigSchemaContributionRegistry, InfoRecord, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import initView, {
	createEditorDrawerRegistry,
	type MemoryViews,
	type RenderStats,
	registerWebUiConfig,
} from '@8f4e/web-ui';

import { disposeAll } from './disposeAll';
import initEvents from './events';
import { createMemoryViewManager } from './memoryViewManager';
import { type EditorPlugin, installEditorPlugins } from './plugins';

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
	ProjectLevel,
	State,
} from '@8f4e/editor-state-types';
export type {
	CanvasOverlayDrawer,
	CanvasOverlayDrawerContext,
	CodeBlockDrawer,
	CodeBlockDrawerContext,
	EditorDrawerRegistry,
} from '@8f4e/web-ui';
export type { EventDispatcher } from './events';
export type { EditorPlugin, EditorPluginContext } from './plugins';
// Re-export helper functions

/** Accepted compiler memory used by generic editor views. */
export interface ProgramArtifacts {
	memoryRef: WebAssembly.Memory;
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
	featureFlags?: Partial<State['featureFlags']>;
	editorConfigSchemaContributions?: EditorConfigSchemaContributionRegistry;
	renderStatsIntervalFrames?: number;
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
		const onCompilationSucceeded = (result: ProgramArtifacts) => {
			updateMemoryViews(result.memoryRef);
		};
		events.on('compilationSucceeded', onCompilationSucceeded);
		cleanups.push(() => events.off('compilationSucceeded', onCompilationSucceeded));
		let store: ReturnType<typeof initState>;
		let view: Awaited<ReturnType<typeof initView>>;

		store = initState(events, {
			...options,
			callbacks: {
				getWordFromMemory: (allocationUnitAddress: number) => {
					return memoryViews.int32[allocationUnitAddress] || 0;
				},
			},
		});
		cleanups.push(() => store.dispose());
		registerWebUiConfig(store);
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

		const initialCanvasSize = getCanvasDisplaySize(canvas) ?? {
			width: canvas.width,
			height: canvas.height,
		};
		events.dispatch('resize', { canvasWidth: initialCanvasSize.width, canvasHeight: initialCanvasSize.height });
		events.dispatch('loadProject', { project: options.initialProject ?? EMPTY_DEFAULT_PROJECT });
		const initialProjectReady = events.dispatchAsync('init');

		view = await initView(store, events, canvas, memoryViews, {
			initialProjectReady,
			drawers,
			renderStatsIntervalFrames: options.renderStatsIntervalFrames,
			onRenderStats: stats => {
				store.set('info.graphics', toGraphicsInfoRecord(stats));
			},
		});
		cleanups.push(() => view.destroy());

		let currentCanvasSize: CanvasSize = initialCanvasSize;
		const resize = (width: number, height: number) => {
			events.dispatch('resize', { canvasWidth: width, canvasHeight: height });
			const resized = view.resize(width, height);
			currentCanvasSize = { width, height };
			if (resized) {
				view.renderFrame();
			}
		};
		const browserWindow = canvas.ownerDocument?.defaultView ?? globalThis.window;
		const resizeObserver = browserWindow?.ResizeObserver
			? new browserWindow.ResizeObserver(() => {
					const size = getCanvasDisplaySize(canvas);
					if (!size || (size.width === currentCanvasSize.width && size.height === currentCanvasSize.height)) {
						return;
					}

					resize(size.width, size.height);
				})
			: null;
		if (resizeObserver) cleanups.push(() => resizeObserver.disconnect());

		view.resize(initialCanvasSize.width, initialCanvasSize.height);
		view.renderFrame();
		resizeObserver?.observe(canvas);
		// The project is installed, its font atlas is ready, and the renderer has drawn.
		events.dispatch('ready');

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
