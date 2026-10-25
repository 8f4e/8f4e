import { beforeEach, describe, expect, it, vi } from 'vitest';

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
} = {
	globalEditorDirectives: {},
	editorConfig: {},
	info: {},
};

const store = {
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
	loadSpriteAtlas: vi.fn(),
	pauseRendering: vi.fn(),
	releaseRenderingResources: vi.fn(),
	resumeRendering: vi.fn(),
	renderFrame: vi.fn(),
	setOverlayTexture: vi.fn(),
	destroy: vi.fn(),
};

const renderProjection = {
	getSnapshot: vi.fn(() => ({ codeBlocks: new Map() })),
	refresh: vi.fn(),
	dispose: vi.fn(),
};

const cleanupSpriteSheet = vi.fn();

vi.mock('@8f4e/web-ui-render-projection', () => ({
	createWebUiRenderProjection: vi.fn(() => renderProjection),
}));

vi.mock('@8f4e/editor-state', () => ({
	default: vi.fn(() => store),
}));

vi.mock('@8f4e/web-ui', () => ({
	default: vi.fn(async () => view),
}));

vi.mock('@8f4e/sprite-generator', () => ({
	default: vi.fn(async () => ({
		spriteAtlas: {
			image: {} as OffscreenCanvas,
			lookup: {},
			spriteIdentifiers: {},
		},
		characterWidth: 8,
		characterHeight: 16,
	})),
}));

vi.mock('./events', () => ({
	default: vi.fn(() => events),
}));

vi.mock('./events/pointerEvents', () => ({
	default: vi.fn(() => () => {}),
}));

vi.mock('./events/keyboardEvents', () => ({
	default: vi.fn(() => () => {}),
}));

vi.mock('./editorEnvironmentPlugins/manager', () => ({
	createEditorEnvironmentPluginManager: vi.fn(() => () => {}),
}));

vi.mock('./spriteSheetManager', () => ({
	createSpriteSheetManager: vi.fn(() => cleanupSpriteSheet),
}));

describe('editor init', () => {
	it('passes state plugins into initialization before dispatching lifecycle events', async () => {
		const { default: init } = await import('./index');
		const { default: initState } = await import('@8f4e/editor-state');
		const plugins = [{ id: 'test', setup: vi.fn() }];
		const editor = await init({ width: 640, height: 480 } as HTMLCanvasElement, {
			plugins,
			runtimeRegistry: {},
			callbacks: { loadSession: async () => null },
		});
		expect(vi.mocked(initState).mock.calls.at(-1)?.[1].plugins).toBe(plugins);
		expect(vi.mocked(initState).mock.invocationCallOrder.at(-1)).toBeLessThan(
			events.dispatch.mock.invocationCallOrder[0]
		);
		editor.dispose();
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
		storeState.editorConfig = {};
		storeState.info = {};
	});

	it('sizes the viewport before loading the session', async () => {
		const { default: init } = await import('./index');
		const canvas = { width: 300, height: 150, clientWidth: 640, clientHeight: 480 } as HTMLCanvasElement;

		await init(canvas, {
			runtimeRegistry: {
				WebWorkerRuntime: {
					id: 'WebWorkerRuntime',
					factory: () => () => {},
				},
			},
			callbacks: {
				loadSession: async () => null,
			},
		});

		expect(events.dispatch.mock.calls.slice(0, 3)).toEqual([
			['init'],
			['resize', { canvasWidth: 640, canvasHeight: 480 }],
			['loadSession'],
		]);
		expect(view.resize).toHaveBeenCalledWith(640, 480);
		expect(view.renderFrame).toHaveBeenCalledOnce();
		expect(view.resize.mock.invocationCallOrder[0]).toBeLessThan(view.renderFrame.mock.invocationCallOrder[0]);
	});

	it('exposes rendering lifecycle controls for this editor instance', async () => {
		const { default: init } = await import('./index');
		const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
		const editor = await init(canvas, {
			runtimeRegistry: {},
			callbacks: { loadSession: async () => null },
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
			callbacks: { loadSession: async () => null },
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
			callbacks: {
				loadSession: async () => null,
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
		const { createEditorEnvironmentPluginManager } = await import('./editorEnvironmentPlugins/manager');
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
			callbacks: {
				loadSession: async () => null,
			},
		});

		expect(canvas.tabIndex).toBe(0);
		expect(keyboardEvents).toHaveBeenLastCalledWith(canvas, events, store);
		expect(createEditorEnvironmentPluginManager).toHaveBeenLastCalledWith(
			store,
			events,
			expect.objectContaining({ inputTarget: canvas })
		);

		editor.dispose();
		expect(canvas.tabIndex).toBe(-1);
	});

	it('disposes state, events, sprite subscriptions, projection, and view exactly once', async () => {
		const { default: init } = await import('./index');
		const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
		const editor = await init(canvas, {
			runtimeRegistry: {},
			callbacks: { loadSession: async () => null },
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

	it('renders one fresh frame before exporting a canvas screenshot', async () => {
		const { default: init } = await import('./index');
		const { default: initState } = await import('@8f4e/editor-state');
		const screenshotBlob = new Blob(['png'], { type: 'image/png' });
		const exportCanvasScreenshot = vi.fn().mockResolvedValue(undefined);
		const canvas = {
			width: 640,
			height: 480,
			toBlob: vi.fn((callback: (blob: Blob | null) => void) => callback(screenshotBlob)),
		} as unknown as HTMLCanvasElement;

		await init(canvas, {
			runtimeRegistry: {
				WebWorkerRuntime: {
					id: 'WebWorkerRuntime',
					factory: () => () => {},
				},
			},
			callbacks: {
				loadSession: async () => null,
				exportCanvasScreenshot,
			},
		});

		const initStateOptions = vi.mocked(initState).mock.calls.at(-1)![1];

		await initStateOptions.callbacks.exportCanvasScreenshot?.('project.png');

		expect(view.renderFrame).toHaveBeenCalledWith();
		expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
		expect(exportCanvasScreenshot).toHaveBeenCalledWith(screenshotBlob, 'project.png');
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
			callbacks: {
				loadSession: async () => null,
			},
		});

		const viewCall = vi.mocked(initView).mock.calls.at(-1)!;
		const viewOptions = viewCall[5]!;
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
		expect(initStateOptions.editorConfigSchemaContributions?.bin).toMatchObject({
			root: 'bin',
			schema: {
				type: 'object',
			},
		});
		expect(initStateOptions.editorConfigSchemaContributions?.keyboard).toMatchObject({
			root: 'keyboard',
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
