import { EMPTY_DEFAULT_PROJECT, jumpToCodeBlock, serializeToProject, setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramArtifacts, SpriteEngine } from './index';
import type { EditorPluginContext } from './plugins';

const events = {
	dispatch: vi.fn(),
	dispatchAsync: vi.fn(async () => {}),
	on: vi.fn(),
	off: vi.fn(),
	dispose: vi.fn(),
};

const storeState: {
	globalEditorDirectives: Record<string, unknown>;
	editorConfig: Record<string, unknown>;
	info: Record<string, unknown>;
	gridSizeReady: boolean;
	viewport: { hGrid: number; vGrid: number };
} = {
	globalEditorDirectives: {},
	editorConfig: {},
	info: {},
	gridSizeReady: false,
	viewport: { hGrid: 0, vGrid: 0 },
};

const store = {
	menus: { registerItem: vi.fn(() => () => {}), registerMenu: vi.fn(() => () => {}) },
	directives: { register: vi.fn(() => () => {}) },
	layout: { createContribution: vi.fn(), subscribe: vi.fn(() => () => {}) },
	loading: { add: vi.fn(() => ({ done: vi.fn(), fail: vi.fn(), cancel: vi.fn() })) },
	getState: vi.fn(() => storeState),
	set: vi.fn((path: string, value: unknown) => {
		if (path === 'info.graphics') {
			storeState.info = {
				...storeState.info,
				graphics: value,
			};
		}
	}),
	subscribe: vi.fn(),
	unsubscribe: vi.fn(),
	dispose: vi.fn(),
};

const view = {
	resize: vi.fn(() => true),
	releaseRenderingResources: vi.fn(),
	resetRenderStats: vi.fn(),
	renderFrame: vi.fn(),
	destroy: vi.fn(),
};

const noop = () => {};
const renderer = {
	gl: {} as WebGL2RenderingContext,
	hooks: { preDraw: [], postDraw: [] },
	frameStats: { spriteCount: 0, uploadedInstanceBytes: 0 },
	setPalette: noop,
	setSpriteAtlas: noop,
	drawSprite: noop,
	resize: noop,
	renderFrame: noop,
	releaseRenderingMemory: noop,
	restoreRenderingMemory: noop,
	destroy: vi.fn(),
} satisfies SpriteEngine;

const requestFrame = vi.fn((_callback: FrameRequestCallback) => 23);
const cancelFrame = vi.fn();

vi.mock('@8f4e/editor-state', async importOriginal => ({
	...(await importOriginal<typeof import('@8f4e/editor-state')>()),
	default: vi.fn(() => store),
	createEditorCommandApi: vi.fn(() => ({ handle: {}, navigation: {}, dispose: vi.fn() })),
}));

vi.mock('@8f4e/web-ui', async importOriginal => ({
	...(await importOriginal<typeof import('@8f4e/web-ui')>()),
	default: vi.fn(async (stateStore: EditorPluginContext['store'], stateEvents: EditorPluginContext['events']) => {
		setGridSize(stateStore.getState(), stateEvents, TEST_GRID_SIZE);
		return view;
	}),
	registerWebUiConfig: vi.fn(),
}));

vi.mock('./events', () => ({
	default: vi.fn(() => events),
}));

describe('editor init', () => {
	afterEach(() => vi.unstubAllGlobals());
	it('announces runtime shutdown before disposing plugin resources', async () => {
		const { default: init } = await import('./index');
		const releaseCompiler = vi.fn();
		const editor = await init({ width: 640, height: 480 } as HTMLCanvasElement, {
			renderer,
			plugins: [{ id: 'compiler', setup: () => releaseCompiler }],
		});
		editor.dispose();
		const shutdown = events.dispatch.mock.calls.findIndex(([name]) => name === 'dispose');
		expect(shutdown).toBeGreaterThanOrEqual(0);
		expect(events.dispatch.mock.invocationCallOrder[shutdown]).toBeLessThan(
			releaseCompiler.mock.invocationCallOrder[0]
		);
	});
	it('distinguishes unavailable memory words from zero in accepted memory views', async () => {
		const { default: init } = await import('./index');
		const { default: initState } = await import('@8f4e/editor-state');
		const editor = await init({ width: 640, height: 480 } as HTMLCanvasElement, { renderer });
		const accept = events.on.mock.calls.find(([name]) => name === 'compilationSucceeded')![1];
		const readWord = vi.mocked(initState).mock.lastCall![1].callbacks!.getWordFromMemory!;
		expect(readWord(0)).toBeUndefined();
		const memoryRef = new WebAssembly.Memory({ initial: 1 });
		new Int32Array(memoryRef.buffer)[1] = 22;
		const artifacts: ProgramArtifacts = { memoryRef };
		accept(artifacts);
		expect(editor.getMemoryViews().int32[1]).toBe(22);
		expect(readWord(0)).toBe(0);
		expect(readWord(1)).toBe(22);
		expect(readWord(editor.getMemoryViews().int32.length)).toBeUndefined();
		editor.dispose();
		expect(events.off).toHaveBeenCalledWith('compilationSucceeded', accept);
	});

	it('disposes acquired resources when renderer initialization rejects', async () => {
		const { default: init } = await import('./index');
		const { default: initState } = await import('@8f4e/editor-state');
		const { default: initView } = await import('@8f4e/web-ui');
		const actualState = await vi.importActual<typeof import('@8f4e/editor-state')>('@8f4e/editor-state');
		vi.mocked(initState).mockImplementationOnce(actualState.default);
		const error = new Error('renderer unavailable');
		vi.mocked(initView).mockRejectedValueOnce(error);
		const cleanup = vi.fn();
		const setup = vi.fn(() => cleanup);
		const canvas = {
			width: 640,
			height: 480,
			tabIndex: -1,
			hasAttribute: () => false,
			removeAttribute: vi.fn(),
		} as unknown as HTMLCanvasElement;
		await expect(
			init(canvas, {
				renderer,
				plugins: [{ id: 'startup-cleanup', setup }],
			})
		).rejects.toBe(error);
		expect(setup).toHaveBeenCalledOnce();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(events.dispose).toHaveBeenCalledOnce();
		expect(view.destroy).not.toHaveBeenCalled();
		expect(renderer.destroy).not.toHaveBeenCalled();
		expect(canvas.removeAttribute).toHaveBeenCalledWith('tabindex');
	});

	it('destroys the renderer if a plugin throws before web-ui takes ownership', async () => {
		const { default: init } = await import('./index');
		const error = new Error('plugin setup failed');
		await expect(
			init({ width: 640, height: 480 } as HTMLCanvasElement, {
				renderer,
				plugins: [
					{
						id: 'broken',
						setup: () => {
							throw error;
						},
					},
				],
			})
		).rejects.toBe(error);
		expect(renderer.destroy).toHaveBeenCalledOnce();
		expect(view.destroy).not.toHaveBeenCalled();
	});

	it('disposes installed plugins and the renderer if asynchronous source preparation rejects', async () => {
		const { default: init } = await import('./index');
		const { default: initEvents } = await import('./events');
		const { default: initView } = await import('@8f4e/web-ui');
		const actualEvents = await vi.importActual<typeof import('./events')>('./events');
		vi.mocked(initEvents).mockReturnValueOnce(actualEvents.default());
		vi.mocked(initView).mockClear();
		const error = new Error('source preparation failed');
		const cleanup = vi.fn();
		await expect(
			init({ width: 640, height: 480 } as HTMLCanvasElement, {
				renderer,
				plugins: [
					{
						id: 'broken-source-loader',
						setup: ({ events }) => {
							events.on('prepareInitialProject', async () => {
								throw error;
							});
							return cleanup;
						},
					},
				],
			})
		).rejects.toBe(error);
		expect(cleanup).toHaveBeenCalledOnce();
		expect(renderer.destroy).toHaveBeenCalledOnce();
		expect(initView).not.toHaveBeenCalled();
		expect(view.renderFrame).not.toHaveBeenCalled();
	});

	it('sets up plugins with state and drawing services before dispatching lifecycle events', async () => {
		const { default: init } = await import('./index');
		const { default: initState } = await import('@8f4e/editor-state');
		const { default: initView, registerWebUiConfig } = await import('@8f4e/web-ui');
		const drawer = vi.fn();
		const plugins = [
			{
				id: 'test',
				setup: vi.fn(({ renderRegistry }: EditorPluginContext) => renderRegistry.registerCodeBlockDrawer(drawer)),
			},
		];
		const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
		const editor = await init(canvas, {
			renderer,
			plugins,
			defaultFont: 'pixelcode6x12',
		});
		expect(vi.mocked(initView).mock.lastCall?.[2]).toBe(renderer);
		expect(plugins[0].setup).toHaveBeenCalledWith({
			store,
			events,
			menus: store.menus,
			directives: store.directives,
			layout: store.layout,
			loading: store.loading,
			renderRegistry: expect.objectContaining({ registerCodeBlockDrawer: expect.any(Function) }),
		});
		expect(vi.mocked(initState).mock.invocationCallOrder.at(-1)).toBeLessThan(
			plugins[0].setup.mock.invocationCallOrder[0]
		);
		expect(registerWebUiConfig).toHaveBeenLastCalledWith(store);
		expect(vi.mocked(registerWebUiConfig).mock.invocationCallOrder.at(-1)).toBeLessThan(
			plugins[0].setup.mock.invocationCallOrder[0]
		);
		expect(plugins[0].setup.mock.invocationCallOrder[0]).toBeLessThan(events.dispatch.mock.invocationCallOrder[0]);
		const initialized = events.dispatch.mock.calls.findIndex(([name]) => name === 'ready');
		expect(view.renderFrame.mock.invocationCallOrder[0]).toBeLessThan(
			events.dispatch.mock.invocationCallOrder[initialized]
		);
		const rendererRegistry = vi.mocked(initView).mock.calls.at(-1)![4]!.renderRegistry!;
		expect(vi.mocked(initView).mock.calls.at(-1)![4]!.defaultFont).toBe('pixelcode6x12');
		expect(rendererRegistry).toBe(plugins[0].setup.mock.calls[0][0].renderRegistry);
		const drawContext = {} as Parameters<typeof rendererRegistry.drawCodeBlock>[0];
		rendererRegistry.drawCodeBlock(drawContext);
		expect(drawer).toHaveBeenCalledOnce();
		editor.dispose();
		rendererRegistry.drawCodeBlock(drawContext);
		expect(drawer).toHaveBeenCalledOnce();
	});

	beforeEach(() => {
		renderer.destroy.mockClear();
		events.dispatch.mockClear();
		events.dispatchAsync.mockClear();
		events.on.mockClear();
		events.off.mockClear();
		events.dispose.mockClear();
		store.getState.mockClear();
		store.set.mockClear();
		store.subscribe.mockClear();
		store.unsubscribe.mockClear();
		store.dispose.mockClear();
		view.resize.mockClear();
		view.releaseRenderingResources.mockClear();
		view.resetRenderStats.mockClear();
		requestFrame.mockClear();
		cancelFrame.mockClear();
		vi.stubGlobal('requestAnimationFrame', requestFrame);
		vi.stubGlobal('cancelAnimationFrame', cancelFrame);
		view.renderFrame.mockClear();
		view.destroy.mockClear();
		storeState.editorConfig = {};
		storeState.info = {};
		storeState.gridSizeReady = false;
		storeState.viewport = { hGrid: 0, vGrid: 0 };
	});

	it('sizes the viewport before loading initial project content', async () => {
		const { default: init } = await import('./index');
		const canvas = { width: 300, height: 150, clientWidth: 640, clientHeight: 480 } as HTMLCanvasElement;

		await init(canvas, { renderer });

		expect(events.dispatch.mock.calls.slice(0, 4)).toEqual([
			['resize', { canvasWidth: 640, canvasHeight: 480 }],
			['loadProject', { project: EMPTY_DEFAULT_PROJECT }],
			['gridSizeChanged'],
			['ready'],
		]);
		expect(events.dispatchAsync).toHaveBeenCalledExactlyOnceWith('prepareInitialProject');
		expect(view.resize).toHaveBeenCalledWith(640, 480);
		expect(view.renderFrame).toHaveBeenCalledOnce();
		expect(view.resize.mock.invocationCallOrder[0]).toBeLessThan(view.renderFrame.mock.invocationCallOrder[0]);
	});

	it('loads an explicitly supplied initial project before the source preparation hook', async () => {
		const { default: init } = await import('./index');
		const project = { ...EMPTY_DEFAULT_PROJECT, notes: [{ id: 0, code: ['note initial', 'noteEnd'] }] };
		await init({ width: 640, height: 480 } as HTMLCanvasElement, {
			renderer,
			initialProject: project,
		});
		const load = events.dispatch.mock.calls.findIndex(([name]) => name === 'loadProject');
		expect(events.dispatch.mock.calls[load][1]).toEqual({ project });
		expect(events.dispatch.mock.invocationCallOrder[load]).toBeLessThan(
			events.dispatchAsync.mock.invocationCallOrder[0]
		);
	});

	it('settles project source, font dimensions, and the initial viewport in sequence before the first frame', async () => {
		const { default: init } = await import('./index');
		const { default: initState } = await import('@8f4e/editor-state');
		const { default: initView, registerWebUiConfig } = await import('@8f4e/web-ui');
		const { default: initEvents } = await import('./events');
		const actualState = await vi.importActual<typeof import('@8f4e/editor-state')>('@8f4e/editor-state');
		const actualEvents = await vi.importActual<typeof import('./events')>('./events');
		const actualWebUi = await vi.importActual<typeof import('@8f4e/web-ui')>('@8f4e/web-ui');
		vi.mocked(initView).mockClear();
		vi.mocked(initState).mockImplementationOnce(actualState.default);
		vi.mocked(initEvents).mockReturnValueOnce(actualEvents.default());
		vi.mocked(registerWebUiConfig).mockImplementationOnce(actualWebUi.registerWebUiConfig);
		let finishProject!: () => void;
		const projectPending = new Promise<void>(resolve => {
			finishProject = resolve;
		});
		let finishFont!: () => void;
		const fontPending = new Promise<void>(resolve => {
			finishFont = resolve;
		});
		const project = {
			...EMPTY_DEFAULT_PROJECT,
			notes: [{ id: 0, code: ['note loaded', '; @config font spleen5x8', '; @pos 8 9', 'noteEnd'] }],
		};
		const ready = vi.fn();
		const projectInstalled = vi.fn();
		const resolveViewport = vi.fn();
		vi.mocked(initView).mockImplementationOnce(async (stateStore, stateEvents) => {
			expect(stateStore.getState().editorConfig.font).toBe('spleen5x8');
			await fontPending;
			setGridSize(stateStore.getState(), stateEvents, { vGrid: 5, hGrid: 8 });
			return view;
		});
		const mounting = init({ width: 640, height: 480 } as HTMLCanvasElement, {
			renderer,
			plugins: [
				{
					id: 'project-preparation',
					setup: ({ store, events }) => {
						events.on('prepareInitialProject', async () => {
							await projectPending;
							events.dispatch('loadProject', { project });
							projectInstalled();
						});
						events.on('resolveInitialProjectViewport', ({ level, position }) => {
							const state = store.getState();
							expect(state.gridSizeReady).toBe(true);
							expect(level).toBe(state.project.activeLevel);
							const block = level.blocks.find(block => block.name === 'loaded')!;
							expect(block).toMatchObject({ x: 40, y: 72 });
							expect(block.width).toBeGreaterThan(0);
							Object.assign(position, { x: block.x, y: block.y });
							resolveViewport();
						});
						events.on('ready', ready);
						return () => {};
					},
				},
			],
		});
		await Promise.resolve();
		expect(initView).not.toHaveBeenCalled();
		expect(resolveViewport).not.toHaveBeenCalled();
		expect(ready).not.toHaveBeenCalled();
		finishProject();
		await vi.waitFor(() => expect(initView).toHaveBeenCalledOnce());
		expect(projectInstalled).toHaveBeenCalledOnce();
		const loadedState = vi.mocked(initView).mock.calls[0][0].getState();
		expect(serializeToProject(loadedState).notes).toEqual(project.notes);
		expect(loadedState.editorConfig.font).toBe('spleen5x8');
		expect(loadedState.compilerInputRevision).toBeGreaterThan(0);
		expect(loadedState.gridSizeReady).toBe(false);
		expect(loadedState.viewport).toMatchObject({ vGrid: 0, hGrid: 0 });
		expect(resolveViewport).not.toHaveBeenCalled();
		expect(view.renderFrame).not.toHaveBeenCalled();
		expect(ready).not.toHaveBeenCalled();
		finishFont();
		const editor = await mounting;
		expect(editor.state.gridSizeReady).toBe(true);
		expect(editor.state.viewport).toMatchObject({ vGrid: 5, hGrid: 8, x: 40, y: 72 });
		expect(resolveViewport).toHaveBeenCalledOnce();
		expect(resolveViewport.mock.invocationCallOrder[0]).toBeLessThan(view.renderFrame.mock.invocationCallOrder[0]);
		expect(ready).toHaveBeenCalledOnce();
		expect(view.renderFrame.mock.invocationCallOrder[0]).toBeLessThan(ready.mock.invocationCallOrder[0]);
		editor.dispose();
	});

	it('exposes rendering lifecycle controls for this editor instance', async () => {
		const { default: init } = await import('./index');
		const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
		const editor = await init(canvas, { renderer });

		expect(requestFrame).toHaveBeenCalledOnce();
		editor.pauseRendering();
		editor.pauseRendering();
		expect(cancelFrame).toHaveBeenCalledExactlyOnceWith(23);
		editor.releaseRenderingResources();
		expect(view.releaseRenderingResources).toHaveBeenCalledOnce();
		editor.resumeRendering();
		editor.resumeRendering();
		expect(view.resetRenderStats).toHaveBeenCalledTimes(2);
		expect(view.renderFrame).toHaveBeenCalledTimes(2);
		expect(requestFrame).toHaveBeenCalledTimes(2);
		editor.dispose();
		expect(cancelFrame).toHaveBeenCalledTimes(2);
		expect(cancelFrame.mock.invocationCallOrder.at(-1)).toBeLessThan(view.destroy.mock.invocationCallOrder[0]);
	});

	it('defers drawing when the view cannot apply a resize while rendering resources are released', async () => {
		const { default: init } = await import('./index');
		const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
		const editor = await init(canvas, { renderer });

		view.resize.mockReturnValueOnce(false);
		view.renderFrame.mockClear();
		editor.resize(800, 600);

		expect(events.dispatch).toHaveBeenCalledWith('resize', { canvasWidth: 800, canvasHeight: 600 });
		expect(view.resize).toHaveBeenLastCalledWith(800, 600);
		expect(view.renderFrame).not.toHaveBeenCalled();
		editor.dispose();
	});

	it('passes scheduled and on-demand timestamps to web-ui without mutating navigation state', async () => {
		const { default: init } = await import('./index');
		const { default: initState } = await import('@8f4e/editor-state');
		const { default: initEvents } = await import('./events');
		const actualState = await vi.importActual<typeof import('@8f4e/editor-state')>('@8f4e/editor-state');
		const actualEvents = await vi.importActual<typeof import('./events')>('./events');
		vi.mocked(initState).mockImplementationOnce(actualState.default);
		vi.mocked(initEvents).mockReturnValueOnce(actualEvents.default());
		let context!: EditorPluginContext;
		const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
		const editor = await init({ width: 640, height: 480 } as HTMLCanvasElement, {
			renderer,
			initialProject: {
				...EMPTY_DEFAULT_PROJECT,
				notes: [{ id: 0, code: ['note target', '; @pos 140 20', 'noteEnd'] }],
			},
			plugins: [
				{
					id: 'frame-test',
					setup: services => {
						context = services;
						return () => {};
					},
				},
			],
		});
		try {
			const state = editor.state;
			const block = state.project.activeLevel.blocks.find(block => block.name === 'target')!;
			const viewportChanged = vi.fn();
			context.events.on('viewportChanged', viewportChanged);
			jumpToCodeBlock(context.store, block.creationIndex, context.events);
			const { x, y } = state.viewport;
			expect(x).toBeGreaterThan(0);
			expect(state.project.selectedCodeBlock).toBe(block);
			expect(viewportChanged).toHaveBeenCalledExactlyOnceWith({
				previousX: 0,
				previousY: 0,
				x,
				y,
				source: 'navigation',
			});
			requestFrame.mock.calls[0][0](1000);
			requestFrame.mock.calls[1][0](1100);
			expect(view.renderFrame).toHaveBeenLastCalledWith(1100);
			expect(requestFrame).toHaveBeenCalledTimes(3);

			editor.pauseRendering();
			now.mockReturnValue(1200);
			editor.renderFrame();
			expect(view.renderFrame).toHaveBeenLastCalledWith(1200);
			expect(state.viewport).toMatchObject({ x, y });
			expect(viewportChanged).toHaveBeenCalledOnce();
			expect(requestFrame).toHaveBeenCalledTimes(3);
		} finally {
			editor.dispose();
			now.mockRestore();
		}
	});

	it('cancels the frame loop before releasing renderer resources', async () => {
		const { default: init } = await import('./index');
		const editor = await init({ width: 640, height: 480 } as HTMLCanvasElement, { renderer });
		editor.releaseRenderingResources();
		expect(cancelFrame).toHaveBeenCalledExactlyOnceWith(23);
		expect(cancelFrame.mock.invocationCallOrder[0]).toBeLessThan(
			view.releaseRenderingResources.mock.invocationCallOrder[0]
		);
		const frames = view.renderFrame.mock.calls.length;
		requestFrame.mock.calls[0][0](1000);
		expect(view.renderFrame).toHaveBeenCalledTimes(frames);
		expect(requestFrame).toHaveBeenCalledOnce();
		editor.dispose();
	});

	it('cleans up when the first frame fails and stops scheduling after a later frame fails', async () => {
		const { default: init } = await import('./index');
		const error = new Error('drawing failed');
		view.renderFrame.mockImplementationOnce(() => {
			throw error;
		});
		await expect(init({ width: 640, height: 480 } as HTMLCanvasElement, { renderer })).rejects.toBe(error);
		expect(view.destroy).toHaveBeenCalledOnce();
		expect(requestFrame).not.toHaveBeenCalled();

		const editor = await init({ width: 640, height: 480 } as HTMLCanvasElement, { renderer });
		view.renderFrame.mockImplementationOnce(() => {
			throw error;
		});
		expect(() => requestFrame.mock.calls[0][0](1000)).toThrow(error);
		expect(requestFrame).toHaveBeenCalledOnce();
		editor.dispose();
	});

	it('adapts to the canvas display size and stops observing when disposed', async () => {
		const { default: init } = await import('./index');
		let resizeCallback: ResizeObserverCallback = () => {};
		const observe = vi.fn();
		const disconnect = vi.fn();
		class ResizeObserverMock {
			constructor(callback: ResizeObserverCallback) {
				resizeCallback = callback;
			}

			observe = observe;
			disconnect = disconnect;
		}
		const canvas = {
			width: 640,
			height: 480,
			clientWidth: 640,
			clientHeight: 480,
			ownerDocument: {
				defaultView: {
					ResizeObserver: ResizeObserverMock,
					navigator: {},
				},
			},
		} as unknown as HTMLCanvasElement;

		const editor = await init(canvas, { renderer });

		expect(observe).toHaveBeenCalledWith(canvas);

		view.renderFrame.mockClear();
		Object.assign(canvas, { clientWidth: 800, clientHeight: 600 });
		resizeCallback([], {} as ResizeObserver);

		expect(events.dispatch).toHaveBeenCalledWith('resize', { canvasWidth: 800, canvasHeight: 600 });
		expect(view.resize).toHaveBeenLastCalledWith(800, 600);
		expect(view.renderFrame).toHaveBeenCalledOnce();
		expect(view.resize.mock.invocationCallOrder.at(-1)).toBeLessThan(view.renderFrame.mock.invocationCallOrder[0]);

		view.resize.mockClear();
		view.renderFrame.mockClear();
		resizeCallback([], {} as ResizeObserver);
		expect(view.resize).not.toHaveBeenCalled();
		expect(view.renderFrame).not.toHaveBeenCalled();

		editor.dispose();
		expect(disconnect).toHaveBeenCalledWith();
	});

	it('makes its canvas focusable and restores its previous tab index when disposed', async () => {
		const { default: init } = await import('./index');
		const canvas = {
			width: 640,
			height: 480,
			clientWidth: 640,
			clientHeight: 480,
			tabIndex: -1,
			hasAttribute: vi.fn(() => false),
			removeAttribute: vi.fn(() => {
				canvas.tabIndex = -1;
			}),
		} as unknown as HTMLCanvasElement;

		const editor = await init(canvas, { renderer });

		expect(canvas.tabIndex).toBe(0);

		editor.dispose();
		expect(canvas.tabIndex).toBe(-1);
	});

	it('disposes state, events, and view exactly once', async () => {
		const { default: init } = await import('./index');
		const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
		const editor = await init(canvas, { renderer });

		editor.dispose();
		editor.dispose();

		expect(store.dispose).toHaveBeenCalledOnce();
		expect(events.dispose).toHaveBeenCalledOnce();
		expect(view.destroy).toHaveBeenCalledOnce();
	});

	it('exposes immediate rendering without a browser-specific plugin service', async () => {
		const { default: init } = await import('./index');
		const editor = await init({ width: 640, height: 480 } as HTMLCanvasElement, { renderer });
		view.renderFrame.mockClear();

		editor.renderFrame();

		expect(view.renderFrame).toHaveBeenCalledOnce();
		editor.dispose();
	});

	it('commits sampled render stats into info.graphics', async () => {
		const { default: init } = await import('./index');
		const { default: initView } = await import('@8f4e/web-ui');
		const canvas = { width: 640, height: 480 } as HTMLCanvasElement;

		await init(canvas, {
			renderer,
			renderStatsIntervalFrames: 12,
		});

		const viewCall = vi.mocked(initView).mock.calls.at(-1)!;
		const viewOptions = viewCall[4]!;
		viewOptions.onRenderStats?.({
			timeToRenderMs: 10,
			fps: 50,
			frameBudgetMs: 20,
			headroomMs: 10,
			fpsCapacity: 100,
			spriteCount: 25,
			uploadedInstanceBytes: 500,
		});

		expect(viewOptions.renderStatsIntervalFrames).toBe(12);
		expect(store.set).toHaveBeenCalledWith('info.graphics', {
			timeToRenderMs: 10,
			fps: 50,
			frameBudgetMs: 20,
			headroomMs: 10,
			fpsCapacity: 100,
			spriteCount: 25,
			uploadedInstanceBytes: 500,
		});
	});
});
