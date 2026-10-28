import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramArtifacts } from './index';
import type { EditorPluginContext } from './plugins';

const events = {
	dispatch: vi.fn(),
	on: vi.fn(),
	off: vi.fn(),
	dispose: vi.fn(),
};

const storeState: {
	globalEditorDirectives: Record<string, unknown>;
	editorConfig: Record<string, unknown>;
	info: Record<string, unknown>;
	viewport: { hGrid: number; vGrid: number };
} = {
	globalEditorDirectives: {},
	editorConfig: {},
	info: {},
	viewport: { hGrid: 16, vGrid: 8 },
};

const store = {
	menus: { registerItem: vi.fn(() => () => {}), registerMenu: vi.fn(() => () => {}) },
	directives: { register: vi.fn(() => () => {}) },
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
	loadFontAtlas: vi.fn(),
	pauseRendering: vi.fn(),
	releaseRenderingResources: vi.fn(),
	resumeRendering: vi.fn(),
	renderFrame: vi.fn(),
	setOverlayTexture: vi.fn(),
	destroy: vi.fn(),
};

const renderProjection = {
	getSnapshot: vi.fn(() => ({ codeBlocks: new Map() })),
	dispose: vi.fn(),
};

const cleanupSpriteSheet = vi.fn();
const cleanupPointer = vi.fn();
const cleanupKeyboard = vi.fn();

vi.mock('@8f4e/web-ui-render-projection', () => ({
	createWebUiRenderProjection: vi.fn(() => renderProjection),
}));

vi.mock('@8f4e/editor-state', async importOriginal => ({
	...(await importOriginal<typeof import('@8f4e/editor-state')>()),
	default: vi.fn(() => store),
}));

vi.mock('@8f4e/web-ui', async importOriginal => ({
	...(await importOriginal<typeof import('@8f4e/web-ui')>()),
	default: vi.fn(async () => view),
}));

vi.mock('@8f4e/sprite-generator', async importOriginal => ({
	...(await importOriginal<typeof import('@8f4e/sprite-generator')>()),
	default: vi.fn(async () => ({
		image: { width: 128, height: 144, data: new Uint8Array(128 * 144) },
		grid: { cellWidth: 8, cellHeight: 16, columns: 16, cellCount: 129 },
	})),
}));

vi.mock('./events', () => ({
	default: vi.fn(() => events),
}));

vi.mock('./events/pointerEvents', () => ({
	default: vi.fn(() => cleanupPointer),
}));

vi.mock('./events/keyboardEvents', () => ({
	default: vi.fn(() => cleanupKeyboard),
}));

vi.mock('./spriteSheetManager', () => ({
	createSpriteSheetManager: vi.fn(() => cleanupSpriteSheet),
}));

describe('editor init', () => {
	it('announces runtime shutdown before disposing plugin resources', async () => {
		const { default: init } = await import('./index');
		const releaseCompiler = vi.fn();
		const editor = await init({ width: 640, height: 480 } as HTMLCanvasElement, {
			runtimeRegistry: {},
			plugins: [{ id: 'compiler', setup: () => releaseCompiler }],
		});
		editor.dispose();
		const shutdown = events.dispatch.mock.calls.findIndex(([name]) => name === 'dispose');
		expect(shutdown).toBeGreaterThanOrEqual(0);
		expect(events.dispatch.mock.invocationCallOrder[shutdown]).toBeLessThan(
			releaseCompiler.mock.invocationCallOrder[0]
		);
	});
	it('refreshes memory views and renderer artifacts from accepted compilation events', async () => {
		const { default: init } = await import('./index');
		const { default: initView } = await import('@8f4e/web-ui');
		const editor = await init({ width: 640, height: 480 } as HTMLCanvasElement, {
			runtimeRegistry: {},
		});
		const renderer = vi.mocked(initView).mock.calls.at(-1)![6]!;
		const accept = events.on.mock.calls.find(([name]) => name === 'compilationSucceeded')![1];
		const memoryRef = new WebAssembly.Memory({ initial: 1 });
		new Int32Array(memoryRef.buffer)[1] = 22;
		const codeBuffer = new Uint8Array([2]);
		const artifacts: ProgramArtifacts = { memoryRef, codeBuffer };
		accept(artifacts);
		expect(editor.getMemoryViews().int32[1]).toBe(22);
		expect(renderer.getMemory?.()).toBe(memoryRef);
		expect(renderer.getCodeBuffer?.()).toEqual(codeBuffer);
		editor.dispose();
		expect(events.off).toHaveBeenCalledWith('compilationSucceeded', accept);
	});

	it.each(['sprites', 'renderer'] as const)(
		'disposes acquired resources when %s initialization rejects',
		async stage => {
			const { default: init } = await import('./index');
			const { default: initState } = await import('@8f4e/editor-state');
			const { default: initView } = await import('@8f4e/web-ui');
			const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
			const actualState = await vi.importActual<typeof import('@8f4e/editor-state')>('@8f4e/editor-state');
			vi.mocked(initState).mockImplementationOnce(actualState.default);
			const error = new Error(`${stage} unavailable`);
			if (stage === 'sprites') vi.mocked(loadFontAtlas).mockRejectedValueOnce(error);
			else vi.mocked(initView).mockRejectedValueOnce(error);
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
					plugins: [{ id: 'startup-cleanup', setup }],
					runtimeRegistry: {},
				})
			).rejects.toBe(error);
			expect(setup).toHaveBeenCalledOnce();
			expect(cleanup).toHaveBeenCalledOnce();
			expect(cleanupPointer).toHaveBeenCalledOnce();
			expect(cleanupKeyboard).toHaveBeenCalledOnce();
			expect(events.dispose).toHaveBeenCalledOnce();
			expect(renderProjection.dispose).toHaveBeenCalledTimes(stage === 'renderer' ? 1 : 0);
			expect(view.destroy).not.toHaveBeenCalled();
			expect(canvas.removeAttribute).toHaveBeenCalledWith('tabindex');
		}
	);

	it('sets up plugins with state and drawing services before dispatching lifecycle events', async () => {
		const { default: init } = await import('./index');
		const { default: initState } = await import('@8f4e/editor-state');
		const { default: initView } = await import('@8f4e/web-ui');
		const drawer = vi.fn();
		const plugins = [
			{ id: 'test', setup: vi.fn(({ drawers }: EditorPluginContext) => drawers.registerCodeBlockDrawer(drawer)) },
		];
		const editor = await init({ width: 640, height: 480 } as HTMLCanvasElement, {
			plugins,
			runtimeRegistry: {},
		});
		expect(plugins[0].setup).toHaveBeenCalledWith({
			store,
			events,
			menus: store.menus,
			directives: store.directives,
			drawers: expect.objectContaining({ registerCodeBlockDrawer: expect.any(Function) }),
		});
		expect(vi.mocked(initState).mock.invocationCallOrder.at(-1)).toBeLessThan(
			plugins[0].setup.mock.invocationCallOrder[0]
		);
		expect(plugins[0].setup.mock.invocationCallOrder[0]).toBeLessThan(events.dispatch.mock.invocationCallOrder[0]);
		const rendererDrawers = vi.mocked(initView).mock.calls.at(-1)![6]!.drawers!;
		expect(rendererDrawers).toBe(plugins[0].setup.mock.calls[0][0].drawers);
		const drawContext = {} as Parameters<typeof rendererDrawers.drawCodeBlock>[0];
		rendererDrawers.drawCodeBlock(drawContext);
		expect(drawer).toHaveBeenCalledOnce();
		editor.dispose();
		rendererDrawers.drawCodeBlock(drawContext);
		expect(drawer).toHaveBeenCalledOnce();
	});

	beforeEach(() => {
		events.dispatch.mockClear();
		events.on.mockClear();
		events.off.mockClear();
		events.dispose.mockClear();
		store.getState.mockClear();
		store.set.mockClear();
		store.subscribe.mockClear();
		store.unsubscribe.mockClear();
		store.dispose.mockClear();
		view.resize.mockClear();
		view.pauseRendering.mockClear();
		view.releaseRenderingResources.mockClear();
		view.resumeRendering.mockClear();
		view.renderFrame.mockClear();
		view.setOverlayTexture.mockClear();
		view.destroy.mockClear();
		renderProjection.dispose.mockClear();
		cleanupSpriteSheet.mockClear();
		cleanupPointer.mockClear();
		cleanupKeyboard.mockClear();
		storeState.editorConfig = {};
		storeState.info = {};
	});

	it('sizes the viewport before loading initial project content', async () => {
		const { default: init } = await import('./index');
		const canvas = { width: 300, height: 150, clientWidth: 640, clientHeight: 480 } as HTMLCanvasElement;

		await init(canvas, {
			runtimeRegistry: {
				WebWorkerRuntime: {
					id: 'WebWorkerRuntime',
					factory: () => () => {},
				},
			},
		});

		expect(events.dispatch.mock.calls.slice(0, 3)).toEqual([
			['resize', { canvasWidth: 640, canvasHeight: 480 }],
			['loadProject', { project: EMPTY_DEFAULT_PROJECT }],
			['init'],
		]);
		expect(view.resize).toHaveBeenCalledWith(640, 480);
		expect(view.renderFrame).toHaveBeenCalledOnce();
		expect(view.resize.mock.invocationCallOrder[0]).toBeLessThan(view.renderFrame.mock.invocationCallOrder[0]);
	});

	it('loads an explicitly supplied initial project before the initialization hook', async () => {
		const { default: init } = await import('./index');
		const project = { ...EMPTY_DEFAULT_PROJECT, notes: [{ id: 0, code: ['note initial', 'noteEnd'] }] };
		await init({ width: 640, height: 480 } as HTMLCanvasElement, {
			initialProject: project,
			runtimeRegistry: {},
		});
		const load = events.dispatch.mock.calls.findIndex(([name]) => name === 'loadProject');
		const ready = events.dispatch.mock.calls.findIndex(([name]) => name === 'init');
		expect(events.dispatch.mock.calls[load][1]).toEqual({ project });
		expect(load).toBeLessThan(ready);
	});

	it('exposes rendering lifecycle controls for this editor instance', async () => {
		const { default: init } = await import('./index');
		const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
		const editor = await init(canvas, {
			runtimeRegistry: {},
		});

		editor.pauseRendering();
		editor.releaseRenderingResources();
		editor.resumeRendering();

		expect(view.pauseRendering).toHaveBeenCalledOnce();
		expect(view.releaseRenderingResources).toHaveBeenCalledOnce();
		expect(view.resumeRendering).toHaveBeenCalledOnce();
	});

	it('defers drawing when the view cannot apply a resize while rendering resources are released', async () => {
		const { default: init } = await import('./index');
		const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
		const editor = await init(canvas, {
			runtimeRegistry: {},
		});

		view.resize.mockReturnValueOnce(false);
		view.renderFrame.mockClear();
		editor.resize(800, 600);

		expect(events.dispatch).toHaveBeenCalledWith('resize', { canvasWidth: 800, canvasHeight: 600 });
		expect(view.resize).toHaveBeenLastCalledWith(800, 600);
		expect(view.renderFrame).not.toHaveBeenCalled();
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

		const editor = await init(canvas, {
			runtimeRegistry: {
				WebWorkerRuntime: {
					id: 'WebWorkerRuntime',
					factory: () => () => {},
				},
			},
		});

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
		const { default: keyboardEvents } = await import('./events/keyboardEvents');
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

		const editor = await init(canvas, {
			runtimeRegistry: {
				WebWorkerRuntime: {
					id: 'WebWorkerRuntime',
					factory: () => () => {},
				},
			},
		});

		expect(canvas.tabIndex).toBe(0);
		expect(keyboardEvents).toHaveBeenLastCalledWith(canvas, events, store);

		editor.dispose();
		expect(canvas.tabIndex).toBe(-1);
	});

	it('disposes state, events, sprite subscriptions, projection, and view exactly once', async () => {
		const { default: init } = await import('./index');
		const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
		const editor = await init(canvas, {
			runtimeRegistry: {},
		});
		const overlaySubscription = store.subscribe.mock.calls.find(([path]) => path === 'editorConfig.webUI')?.[1];

		editor.dispose();
		editor.dispose();

		expect(cleanupSpriteSheet).toHaveBeenCalledOnce();
		expect(renderProjection.dispose).toHaveBeenCalledOnce();
		expect(store.unsubscribe).toHaveBeenCalledOnce();
		expect(store.unsubscribe).toHaveBeenCalledWith('editorConfig.webUI', overlaySubscription);
		expect(store.dispose).toHaveBeenCalledOnce();
		expect(events.dispose).toHaveBeenCalledOnce();
		expect(view.destroy).toHaveBeenCalledOnce();
	});

	it('exposes immediate rendering without a browser-specific plugin service', async () => {
		const { default: init } = await import('./index');
		const editor = await init({ width: 640, height: 480 } as HTMLCanvasElement, {
			runtimeRegistry: {},
		});
		view.renderFrame.mockClear();

		editor.renderFrame();

		expect(view.renderFrame).toHaveBeenCalledOnce();
		editor.dispose();
	});

	it('commits sampled render stats into info.graphics', async () => {
		const { default: init } = await import('./index');
		const { default: initState } = await import('@8f4e/editor-state');
		const { default: initView } = await import('@8f4e/web-ui');
		const canvas = { width: 640, height: 480 } as HTMLCanvasElement;

		await init(canvas, {
			runtimeRegistry: {
				WebWorkerRuntime: {
					id: 'WebWorkerRuntime',
					factory: () => () => {},
				},
			},
			renderStatsIntervalFrames: 12,
			overlayTexture: {
				entry: 'renderFrame',
				target: 'screen:rgba',
				width: 1,
				height: 1,
			},
		});

		const viewCall = vi.mocked(initView).mock.calls.at(-1)!;
		const viewOptions = viewCall[6]!;
		const initStateOptions = vi.mocked(initState).mock.calls.at(-1)![1];
		expect(viewCall[1]).toBe(renderProjection);
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
		expect(viewOptions.overlayTexture).toEqual({
			entry: 'renderFrame',
			target: 'screen:rgba',
			width: 1,
			height: 1,
		});
		expect(view.setOverlayTexture).toHaveBeenCalledWith({
			entry: 'renderFrame',
			target: 'screen:rgba',
			width: 1,
			height: 1,
		});
		const overlaySubscription = store.subscribe.mock.calls.find(([path]) => path === 'editorConfig.webUI')?.[1];
		expect(overlaySubscription).toBeTypeOf('function');
		storeState.editorConfig = {
			webUI: {
				overlay: {
					entry: 'draw',
					target: 'screen:pixels',
					width: 64,
					height: 32,
					magnification: 3,
					position: 'left',
				},
			},
		};
		overlaySubscription?.();
		expect(view.setOverlayTexture).toHaveBeenLastCalledWith({
			entry: 'draw',
			target: 'screen:pixels',
			width: 64,
			height: 32,
			magnification: 3,
			position: 'left',
		});
		expect(viewOptions.getCodeBuffer?.()).toBeInstanceOf(Uint8Array);
		expect(viewOptions.getMemory?.()).toBeNull();
		expect(initStateOptions.editorConfigSchemaContributions?.['web-ui']).toMatchObject({
			root: 'webUI',
			schema: {
				type: 'object',
			},
		});

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
