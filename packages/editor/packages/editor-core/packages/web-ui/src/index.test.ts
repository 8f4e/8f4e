import { resolvePalette, toPaletteBytes } from '@8f4e/editor-palette';
import { createMockEventDispatcher, createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditorDrawerRegistry } from './drawers/registry';

const mocks = vi.hoisted(() => {
	const engine = {
		hooks: {
			preDraw: [] as Array<() => void>,
			postDraw: [] as Array<() => void>,
		},
		frameStats: {
			spriteCount: 100,
			uploadedInstanceBytes: 2000,
		},
		setPalette: vi.fn(),
		setSpriteAtlas: vi.fn(),
		drawSprite: vi.fn(),
		drawFill: vi.fn(),
		drawCharacter: vi.fn(),
		renderFrame: vi.fn((drawFrame: () => void) => {
			for (const hook of engine.hooks.preDraw) hook();
			drawFrame();
			for (const hook of engine.hooks.postDraw) hook();
		}),
		resize: vi.fn(),
		releaseRenderingMemory: vi.fn(),
		restoreRenderingMemory: vi.fn(),
		destroy: vi.fn(),
	};
	const background = { setFont: vi.fn(), setPalette: vi.fn(), destroy: vi.fn() };

	return {
		engine,
		background,
		// biome-ignore lint/complexity/useArrowFunction: Engine is constructed with new in the code under test.
		Engine: vi.fn(function () {
			engine.hooks.preDraw.length = 0;
			engine.hooks.postDraw.length = 0;
			return engine;
		}),
		// biome-ignore lint/complexity/useArrowFunction: The background renderer is constructed with new.
		BackgroundRenderer: vi.fn(function () {
			return background;
		}),
		drawCodeBlocks: vi.fn(),
		drawContextMenu: vi.fn(),
		drawDialog: vi.fn(),
	};
});

vi.mock('glugglugglug', () => ({
	Engine: mocks.Engine,
}));

vi.mock('./plugins/background', () => ({
	default: mocks.BackgroundRenderer,
}));

vi.mock('./drawers/codeBlocks', () => ({
	default: mocks.drawCodeBlocks,
}));

vi.mock('./drawers/contextMenu', () => ({
	default: mocks.drawContextMenu,
}));

vi.mock('./drawers/dialog', () => ({
	default: mocks.drawDialog,
}));

vi.mock('@8f4e/sprite-generator', async original => ({
	...(await original<typeof import('@8f4e/sprite-generator')>()),
	default: vi.fn(async () => createFontAtlas()),
}));

function createFontAtlas(characterWidth = 8, characterHeight = 16) {
	return {
		image: {
			width: characterWidth * 16,
			height: characterHeight * 9,
			data: new Uint8Array(characterWidth * 16 * characterHeight * 9),
		},
		grid: { cellWidth: characterWidth, cellHeight: characterHeight, columns: 16, cellCount: 129 },
	};
}

function createMemoryViews() {
	return {
		int8: new Int8Array(0),
		int16: new Int16Array(0),
		int32: new Int32Array(0),
		uint8: new Uint8Array(0),
		uint16: new Uint16Array(0),
		float32: new Float32Array(0),
		float64: new Float64Array(0),
	};
}

describe('web-ui init', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads the configured font and installs its grid before initializing render layers', async () => {
		const { default: init } = await import('./index');
		const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
		const state = createMockState({ editorConfig: { font: '6x10' } });
		const events = { ...createMockEventDispatcher(), dispatch: vi.fn() };
		const drawers = createEditorDrawerRegistry();
		const factory = vi.fn(() => {
			expect(state.viewport).toMatchObject({ vGrid: 6, hGrid: 10 });
			return { draw: vi.fn(), destroy: vi.fn() };
		});
		drawers.registerRenderLayer(factory);
		vi.mocked(loadFontAtlas).mockResolvedValueOnce(createFontAtlas()).mockResolvedValueOnce(createFontAtlas(6, 10));
		const view = await init(createStateManager(state), events, {} as HTMLCanvasElement, createMemoryViews(), {
			drawers,
		});
		expect(loadFontAtlas).toHaveBeenNthCalledWith(1, 'ibmvga8x16');
		expect(loadFontAtlas).toHaveBeenNthCalledWith(2, '6x10');
		expect(factory).toHaveBeenCalledOnce();
		expect(events.dispatch).toHaveBeenCalledExactlyOnceWith('gridSizeChanged');
		view.destroy();
	});

	it('does not acquire GPU resources when the initial font fails to load', async () => {
		const { default: init } = await import('./index');
		const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
		const error = new Error('Font unavailable');
		vi.mocked(loadFontAtlas).mockRejectedValueOnce(error);
		await expect(
			init(
				createStateManager(createMockState()),
				createMockEventDispatcher(),
				{} as HTMLCanvasElement,
				createMemoryViews()
			)
		).rejects.toBe(error);
		expect(mocks.Engine).not.toHaveBeenCalled();
	});

	it.each(['project', 'font'])('loads project and font in parallel and waits for both (%s first)', async first => {
		const { default: init } = await import('./index');
		const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
		let finishProject!: () => void;
		const initialProjectReady = new Promise<void>(resolve => {
			finishProject = resolve;
		});
		const atlas = createFontAtlas();
		let finishFont!: (value: typeof atlas) => void;
		vi.mocked(loadFontAtlas).mockImplementationOnce(
			() =>
				new Promise(resolve => {
					finishFont = resolve;
				})
		);
		const mounting = init(
			createStateManager(createMockState()),
			createMockEventDispatcher(),
			{} as HTMLCanvasElement,
			createMemoryViews(),
			{ initialProjectReady }
		);
		expect(loadFontAtlas).toHaveBeenCalledOnce();
		expect(mocks.Engine).not.toHaveBeenCalled();
		if (first === 'project') finishProject();
		else finishFont(atlas);
		await Promise.resolve();
		expect(mocks.Engine).not.toHaveBeenCalled();
		if (first === 'project') finishFont(atlas);
		else finishProject();
		const view = await mounting;
		expect(mocks.engine.renderFrame).not.toHaveBeenCalled();
		view.renderFrame();
		expect(mocks.engine.renderFrame).toHaveBeenCalledOnce();
		view.destroy();
	});

	it('waits for a different font selected by the loaded project before rendering', async () => {
		const { default: init } = await import('./index');
		const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
		const state = createMockState();
		const store = createStateManager(state);
		let finishProject!: () => void;
		const initialProjectReady = new Promise<void>(resolve => {
			finishProject = resolve;
		});
		const atlas = createFontAtlas(5, 8);
		let finishFont!: (value: typeof atlas) => void;
		vi.mocked(loadFontAtlas)
			.mockResolvedValueOnce(createFontAtlas())
			.mockImplementationOnce(
				() =>
					new Promise(resolve => {
						finishFont = resolve;
					})
			);
		const mounting = init(store, createMockEventDispatcher(), {} as HTMLCanvasElement, createMemoryViews(), {
			initialProjectReady,
		});
		store.set('editorConfig.font', 'spleen5x8');
		finishProject();
		await vi.waitFor(() => expect(loadFontAtlas).toHaveBeenLastCalledWith('spleen5x8'));
		expect(mocks.Engine).not.toHaveBeenCalled();
		finishFont(atlas);
		const view = await mounting;
		expect(state.viewport).toMatchObject({ vGrid: 5, hGrid: 8 });
		expect(mocks.background.setFont).toHaveBeenCalledExactlyOnceWith('spleen5x8', atlas.grid);
		view.destroy();
		store.dispose();
	});

	it('renders viewport overlays after menus and before dialogs with the current frame state', async () => {
		const { default: init } = await import('./index');
		const state = createMockState();
		const memoryViews = createMemoryViews();

		const drawers = createEditorDrawerRegistry();
		const overlay = vi.fn();
		const removeOverlay = drawers.registerCanvasOverlay(overlay);
		const view = await init(
			createStateManager(state),
			createMockEventDispatcher(),
			{} as HTMLCanvasElement,
			memoryViews,
			{ drawers }
		);

		overlay.mockClear();
		mocks.drawContextMenu.mockClear();
		mocks.drawDialog.mockClear();
		view.renderFrame();

		const frameState = mocks.drawCodeBlocks.mock.calls.at(-1)?.[1];

		expect(frameState).toBe(state);
		expect(overlay).toHaveBeenCalledWith({ draw: expect.anything(), state, memoryViews });
		expect(mocks.drawContextMenu.mock.invocationCallOrder[0]).toBeLessThan(overlay.mock.invocationCallOrder[0]);
		expect(overlay.mock.invocationCallOrder[0]).toBeLessThan(mocks.drawDialog.mock.invocationCallOrder[0]);
		state.featureFlags.canvasOverlays = false;
		view.renderFrame();
		expect(overlay).toHaveBeenCalledOnce();
		state.featureFlags.canvasOverlays = true;
		removeOverlay();
		view.renderFrame();
		expect(overlay).toHaveBeenCalledOnce();
		view.destroy();
	});

	it('draws registered render layers above sprites in registration order', async () => {
		const { default: init } = await import('./index');
		const state = createMockState();
		const memoryViews = createMemoryViews();
		const drawers = createEditorDrawerRegistry();
		const drawLayer = vi.fn();
		drawers.registerRenderLayer(() => ({ draw: drawLayer, destroy: vi.fn() }));
		const drawTopLayer = vi.fn();
		drawers.registerRenderLayer(() => ({ draw: drawTopLayer, destroy: vi.fn() }));
		const view = await init(
			createStateManager(state),
			createMockEventDispatcher(),
			{} as HTMLCanvasElement,
			memoryViews,
			{
				drawers,
			}
		);
		view.renderFrame();

		expect(drawLayer).toHaveBeenCalledOnce();
		expect(mocks.drawCodeBlocks.mock.invocationCallOrder[0]).toBeLessThan(drawLayer.mock.invocationCallOrder[0]);
		expect(drawLayer.mock.invocationCallOrder[0]).toBeLessThan(drawTopLayer.mock.invocationCallOrder[0]);
		view.destroy();
	});

	it('draws supplied viewport state without advancing navigation', async () => {
		const { default: init } = await import('./index');
		const state = createMockState({
			viewport: { x: 24, y: 32 },
			viewportAnimation: { active: true, startX: 0, startY: 0, targetX: 100, targetY: 200 },
		});
		const events = { ...createMockEventDispatcher(), dispatch: vi.fn() };
		const view = await init(createStateManager(state), events, {} as HTMLCanvasElement, createMemoryViews());
		expect(mocks.engine.renderFrame).not.toHaveBeenCalled();
		const viewport = structuredClone(state.viewport);
		const animation = { ...state.viewportAnimation };
		events.dispatch.mockClear();
		view.renderFrame();
		view.renderFrame();
		expect(mocks.drawCodeBlocks).toHaveBeenCalledTimes(2);
		expect(mocks.drawCodeBlocks.mock.calls.at(-1)?.[1]).toBe(state);
		expect(state.viewport).toEqual(viewport);
		expect(state.viewportAnimation).toEqual(animation);
		expect(events.dispatch).not.toHaveBeenCalled();
		view.destroy();
	});

	it('releases rendering resources and restores the latest deferred size before drawing', async () => {
		const { default: init } = await import('./index');
		const state = createMockState();
		const memoryViews = createMemoryViews();
		const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
		const view = await init(createStateManager(state), createMockEventDispatcher(), canvas, memoryViews);

		view.releaseRenderingResources();
		view.releaseRenderingResources();

		expect(mocks.engine.releaseRenderingMemory).toHaveBeenCalledOnce();
		expect(canvas).toEqual(expect.objectContaining({ width: 1, height: 1 }));
		expect(view.resize(800, 600)).toBe(false);
		expect(mocks.engine.resize).not.toHaveBeenCalled();

		view.renderFrame();

		expect(mocks.engine.restoreRenderingMemory).toHaveBeenCalledOnce();
		expect(mocks.engine.resize).toHaveBeenCalledOnce();
		expect(mocks.engine.resize).toHaveBeenCalledWith(800, 600);
		expect(mocks.engine.renderFrame).toHaveBeenCalledOnce();
		view.destroy();
	});

	it('updates palette independently of font atlas replacement', async () => {
		const { default: init } = await import('./index');
		const state = createMockState();
		const store = createStateManager(state);
		const memoryViews = createMemoryViews();
		const drawers = createEditorDrawerRegistry();
		const loadPalette = vi.fn();
		drawers.registerRenderLayer(() => ({ draw: vi.fn(), destroy: vi.fn(), loadPalette }));
		const view = await init(store, createMockEventDispatcher(), {} as HTMLCanvasElement, memoryViews, { drawers });
		const paletteUploads = mocks.engine.setPalette.mock.calls.length;
		const backgroundPaletteUploads = mocks.background.setPalette.mock.calls.length;
		const atlasUploads = mocks.engine.setSpriteAtlas.mock.calls.length;
		store.set('editorConfig.font', 'ibmvga8x16');
		await vi.waitFor(() => expect(mocks.engine.setSpriteAtlas).toHaveBeenCalledTimes(atlasUploads + 1));
		expect(mocks.engine.setPalette).toHaveBeenCalledTimes(paletteUploads);
		expect(mocks.background.setPalette).toHaveBeenCalledTimes(backgroundPaletteUploads);

		const installCount = mocks.engine.setSpriteAtlas.mock.calls.length;
		const palette = resolvePalette({ primary: '#00ff00' });
		store.set('editorConfig.color', { primary: '#00ff00' });
		expect(mocks.engine.setPalette).toHaveBeenLastCalledWith(toPaletteBytes(palette));
		expect(loadPalette).toHaveBeenCalledExactlyOnceWith(palette);
		expect(mocks.background.setPalette).toHaveBeenCalledWith(mocks.engine.setPalette.mock.calls.at(-1)?.[0]);
		expect(mocks.engine.setSpriteAtlas).toHaveBeenCalledTimes(installCount);
		view.destroy();
		store.dispose();
	});

	it('updates font dimensions and background settings when the atlas is replaced', async () => {
		const { default: init } = await import('./index');
		const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
		const state = createMockState();
		const store = createStateManager(state);
		const memoryViews = createMemoryViews();

		const view = await init(store, createMockEventDispatcher(), {} as HTMLCanvasElement, memoryViews);

		vi.mocked(loadFontAtlas).mockResolvedValueOnce(createFontAtlas(10, 18));
		store.set('editorConfig.font', 'terminus10x18');
		await vi.waitFor(() =>
			expect(mocks.engine.setSpriteAtlas).toHaveBeenLastCalledWith(
				createFontAtlas(10, 18).image,
				createFontAtlas(10, 18).grid
			)
		);
		expect(mocks.background.setFont).toHaveBeenLastCalledWith('terminus10x18', createFontAtlas(10, 18).grid);
		expect(state.viewport).toMatchObject({ vGrid: 10, hGrid: 18 });
		view.destroy();
		store.dispose();
	});

	it('restarts FPS sampling when the host resumes after a pause without drawing', async () => {
		let now = 0;
		const performanceNow = vi.spyOn(performance, 'now').mockImplementation(() => now);
		const { default: init } = await import('./index');
		const onRenderStats = vi.fn();
		const view = await init(
			createStateManager(createMockState()),
			createMockEventDispatcher(),
			{} as HTMLCanvasElement,
			createMemoryViews(),
			{ onRenderStats, renderStatsIntervalFrames: 2 }
		);
		try {
			view.renderFrame();
			now = 1000;
			view.resetRenderStats();
			expect(mocks.engine.renderFrame).toHaveBeenCalledOnce();
			now = 1010;
			view.renderFrame();
			expect(onRenderStats).toHaveBeenCalledWith(expect.objectContaining({ fps: 100, frameBudgetMs: 10 }));
		} finally {
			view.destroy();
			performanceNow.mockRestore();
		}
	});

	it('emits render stats at the configured frame interval', async () => {
		let now = 0;
		const performanceNow = vi.spyOn(performance, 'now').mockImplementation(() => now);
		mocks.drawCodeBlocks.mockImplementationOnce(() => {
			now += 10;
		});
		const { default: init } = await import('./index');
		const state = createMockState();
		const memoryViews = createMemoryViews();
		const onRenderStats = vi.fn();

		const view = await init(
			createStateManager(state),
			createMockEventDispatcher(),
			{} as HTMLCanvasElement,
			memoryViews,
			{
				onRenderStats,
				renderStatsIntervalFrames: 2,
			}
		);
		view.renderFrame();
		expect(onRenderStats).not.toHaveBeenCalled();

		now = 40;
		mocks.drawCodeBlocks.mockImplementationOnce(() => {
			now += 10;
		});
		view.renderFrame();
		expect(onRenderStats).toHaveBeenCalledTimes(1);
		expect(onRenderStats).toHaveBeenCalledWith({
			timeToRenderMs: 10,
			fps: 40,
			frameBudgetMs: 25,
			headroomMs: 15,
			fpsCapacity: 100,
			spriteCount: 100,
			uploadedInstanceBytes: 2000,
		});

		view.renderFrame();
		expect(onRenderStats).toHaveBeenCalledTimes(1);
		view.destroy();
		performanceNow.mockRestore();
	});
});
