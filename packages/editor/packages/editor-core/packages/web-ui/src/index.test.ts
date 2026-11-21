import { EventEmitter } from 'node:events';
import { resolvePalette, toPaletteBytes } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockEventDispatcher, createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditorDrawerRegistry } from './drawers/registry';
import initWebUi from './index';

const loading = { add: vi.fn(() => ({ done: vi.fn(), fail: vi.fn(), cancel: vi.fn() })) };

const mocks = vi.hoisted(() => {
	const engine = {
		gl: { drawingBufferWidth: 640, drawingBufferHeight: 480 } as WebGL2RenderingContext,
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
		// biome-ignore lint/complexity/useArrowFunction: The background renderer is constructed with new.
		BackgroundRenderer: vi.fn(function (_engine: typeof engine, _readViewportOrigin: () => { x: number; y: number }) {
			return background;
		}),
		drawCodeBlocks: vi.fn(),
	};
});

vi.mock('./plugins/background', () => ({
	default: mocks.BackgroundRenderer,
}));

vi.mock('./drawers/codeBlocks', () => ({
	default: mocks.drawCodeBlocks,
}));

vi.mock('@8f4e/sprite-generator', async original => ({
	...(await original<typeof import('@8f4e/sprite-generator')>()),
	default: vi.fn(async () => createFontAtlas()),
}));

function createFontAtlas(characterWidth = 8, characterHeight = 16) {
	return {
		image: {
			width: characterWidth * 16,
			height: characterHeight * 17,
			data: new Uint8Array(characterWidth * 16 * characterHeight * 17),
		},
		grid: { cellWidth: characterWidth, cellHeight: characterHeight, columns: 16, cellCount: 257 },
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

function init(
	store: Parameters<typeof initWebUi>[0],
	events: Parameters<typeof initWebUi>[1],
	memoryViews: Parameters<typeof initWebUi>[3],
	options: Parameters<typeof initWebUi>[4]
) {
	return initWebUi(store, events, mocks.engine, memoryViews, options);
}

describe('web-ui init', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.engine.hooks.preDraw.length = 0;
		mocks.engine.hooks.postDraw.length = 0;
	});

	it('submits sprites through an injected renderer without constructing a canvas', async () => {
		const drawers = createEditorDrawerRegistry();
		drawers.registerCanvasDrawer(({ draw }) => draw.drawFill(4, 8, 0, 12, 16));
		const view = await init(createStateManager(createMockState()), createMockEventDispatcher(), createMemoryViews(), {
			loading,
			drawers,
		});
		view.renderFrame();
		expect(mocks.engine.drawSprite).toHaveBeenCalledExactlyOnceWith(4, 8, 256, 0, 12, 16);
		view.destroy();
		expect(mocks.engine.destroy).toHaveBeenCalledOnce();
	});

	it('supplies the current presented viewport origin to the procedural background', async () => {
		const store = createStateManager(createMockState({ viewport: { x: -23, y: 12 } }));
		const view = await init(store, createMockEventDispatcher(), createMemoryViews(), { loading });
		const readViewportOrigin = mocks.BackgroundRenderer.mock.lastCall![1];
		expect(readViewportOrigin()).toMatchObject({ x: -23, y: 12 });

		store.set('viewport', { ...store.getState().viewport, x: 44, y: -39 });
		view.renderFrame();
		expect(readViewportOrigin()).toMatchObject({ x: 44, y: -39 });
		view.destroy();
		store.dispose();
	});

	it('loads the configured font and installs its grid before initializing render layers', async () => {
		const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
		const state = createMockState({ editorConfig: { font: 'x11miscfixed6x10' } });
		const events = { ...createMockEventDispatcher(), dispatch: vi.fn() };
		const drawers = createEditorDrawerRegistry();
		const factory = vi.fn(() => {
			expect(state.viewport).toMatchObject({ vGrid: 6, hGrid: 10 });
			return { draw: vi.fn(), destroy: vi.fn() };
		});
		drawers.registerRenderLayer(factory);
		vi.mocked(loadFontAtlas)
			.mockResolvedValueOnce(createFontAtlas(6, 12))
			.mockResolvedValueOnce(createFontAtlas(6, 10));
		const view = await init(createStateManager(state), events, createMemoryViews(), {
			loading,
			drawers,
			defaultFont: 'pixelcode6x12',
		});
		expect(loadFontAtlas).toHaveBeenNthCalledWith(1, 'pixelcode6x12');
		expect(loadFontAtlas).toHaveBeenNthCalledWith(2, 'x11miscfixed6x10');
		expect(factory).toHaveBeenCalledOnce();
		expect(events.dispatch).toHaveBeenCalledExactlyOnceWith('gridSizeChanged');
		view.destroy();
	});

	it('uses an instance default initially and restores it when project configuration is removed', async () => {
		const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
		const state = createMockState();
		const store = createStateManager(state);
		const atlas = createFontAtlas(6, 12);
		vi.mocked(loadFontAtlas).mockResolvedValueOnce(atlas);
		const view = await init(store, createMockEventDispatcher(), createMemoryViews(), {
			loading,
			defaultFont: 'pixelcode6x12',
		});
		expect(loadFontAtlas).toHaveBeenCalledExactlyOnceWith('pixelcode6x12');
		expect(state.viewport).toMatchObject({ vGrid: 6, hGrid: 12 });
		expect(state.editorConfig).toEqual({});
		vi.mocked(loadFontAtlas).mockResolvedValueOnce(createFontAtlas(8, 16)).mockResolvedValueOnce(atlas);
		store.set('editorConfig', { font: 'ibmvga8x16' });
		await Promise.resolve();
		expect(state.viewport).toMatchObject({ vGrid: 8, hGrid: 16 });
		store.set('editorConfig', {});
		await Promise.resolve();
		expect(state.viewport).toMatchObject({ vGrid: 6, hGrid: 12 });
		expect(state.editorConfig).toEqual({});
		expect(mocks.background.setFont).toHaveBeenLastCalledWith('pixelcode6x12', atlas.grid);
		view.destroy();
		store.dispose();
	});

	it('destroys the supplied renderer without attaching effects when the initial font fails', async () => {
		const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
		const error = new Error('Font unavailable');
		vi.mocked(loadFontAtlas).mockRejectedValueOnce(error);
		await expect(
			init(createStateManager(createMockState()), createMockEventDispatcher(), createMemoryViews(), { loading })
		).rejects.toBe(error);
		expect(mocks.BackgroundRenderer).not.toHaveBeenCalled();
		expect(mocks.engine.setSpriteAtlas).not.toHaveBeenCalled();
		expect(mocks.engine.destroy).toHaveBeenCalledOnce();
	});

	it.each(['project', 'font'])('loads project and font in parallel and waits for both (%s first)', async first => {
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
		const mounting = init(createStateManager(createMockState()), createMockEventDispatcher(), createMemoryViews(), {
			loading,
			initialProjectReady,
		});
		expect(loadFontAtlas).toHaveBeenCalledOnce();
		expect(mocks.BackgroundRenderer).not.toHaveBeenCalled();
		if (first === 'project') finishProject();
		else finishFont(atlas);
		await Promise.resolve();
		expect(mocks.engine.setSpriteAtlas).not.toHaveBeenCalled();
		if (first === 'project') finishFont(atlas);
		else finishProject();
		const view = await mounting;
		expect(mocks.engine.renderFrame).not.toHaveBeenCalled();
		view.renderFrame();
		expect(mocks.engine.renderFrame).toHaveBeenCalledOnce();
		view.destroy();
	});

	it('waits for a different font selected by the loaded project before rendering', async () => {
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
		const mounting = init(store, createMockEventDispatcher(), createMemoryViews(), {
			loading,
			initialProjectReady,
		});
		store.set('editorConfig.font', 'spleen5x8');
		finishProject();
		await vi.waitFor(() => expect(loadFontAtlas).toHaveBeenLastCalledWith('spleen5x8'));
		expect(mocks.BackgroundRenderer).not.toHaveBeenCalled();
		finishFont(atlas);
		const view = await mounting;
		expect(state.viewport).toMatchObject({ vGrid: 5, hGrid: 8 });
		expect(mocks.background.setFont).toHaveBeenCalledExactlyOnceWith('spleen5x8', atlas.grid);
		view.destroy();
		store.dispose();
	});

	it('renders canvas backgrounds, blocks, canvas drawers, and overlays in order with the current frame state', async () => {
		const state = createMockState();
		const memoryViews = createMemoryViews();

		const drawers = createEditorDrawerRegistry();
		const background = vi.fn();
		const removeBackground = drawers.registerCanvasBackgroundDrawer(background);
		const canvas = vi.fn();
		const removeCanvas = drawers.registerCanvasDrawer(canvas);
		const overlay = vi.fn();
		const removeOverlay = drawers.registerCanvasOverlay(overlay);
		const modal = vi.fn();
		const removeModal = drawers.registerModalOverlay(modal);
		// Late registrations stay within their drawing stage, even when higher stages registered first.
		const menu = vi.fn();
		const removeMenu = drawers.registerContextMenuOverlay(menu);
		const lastOverlay = vi.fn();
		const removeLastOverlay = drawers.registerCanvasOverlay(lastOverlay);
		const view = await init(createStateManager(state), createMockEventDispatcher(), memoryViews, { loading, drawers });

		overlay.mockClear();
		background.mockClear();
		canvas.mockClear();
		modal.mockClear();
		menu.mockClear();
		lastOverlay.mockClear();
		view.renderFrame();

		const frameState = mocks.drawCodeBlocks.mock.calls.at(-1)?.[1];
		const renderGeometry = mocks.drawCodeBlocks.mock.calls.at(-1)?.[4];

		expect(frameState).toBe(state);
		const frame = { draw: expect.anything(), state, viewport: state.viewport, memoryViews, renderGeometry };
		expect(background).toHaveBeenCalledWith(frame);
		expect(background.mock.invocationCallOrder[0]).toBeLessThan(mocks.drawCodeBlocks.mock.invocationCallOrder.at(-1)!);
		expect(canvas).toHaveBeenCalledWith(frame);
		expect(mocks.drawCodeBlocks.mock.invocationCallOrder.at(-1)!).toBeLessThan(canvas.mock.invocationCallOrder[0]);
		expect(overlay).toHaveBeenCalledWith(frame);
		for (const drawer of [background, canvas, overlay, lastOverlay, menu, modal]) {
			expect(drawer.mock.calls[0][0].renderGeometry).toBe(renderGeometry);
		}
		expect(canvas.mock.invocationCallOrder[0]).toBeLessThan(overlay.mock.invocationCallOrder[0]);
		expect(overlay.mock.invocationCallOrder[0]).toBeLessThan(lastOverlay.mock.invocationCallOrder[0]);
		expect(lastOverlay.mock.invocationCallOrder[0]).toBeLessThan(menu.mock.invocationCallOrder[0]);
		expect(menu.mock.invocationCallOrder[0]).toBeLessThan(modal.mock.invocationCallOrder[0]);
		state.featureFlags.canvasOverlays = false;
		view.renderFrame();
		expect(overlay).toHaveBeenCalledOnce();
		expect(lastOverlay).toHaveBeenCalledOnce();
		expect(menu).toHaveBeenCalledTimes(2);
		expect(canvas).toHaveBeenCalledTimes(2);
		expect(background).toHaveBeenCalledTimes(2);
		expect(modal).toHaveBeenCalledTimes(2);
		state.featureFlags.canvasOverlays = true;
		removeBackground();
		removeCanvas();
		removeOverlay();
		removeModal();
		removeMenu();
		removeLastOverlay();
		view.renderFrame();
		expect(canvas).toHaveBeenCalledTimes(2);
		expect(background).toHaveBeenCalledTimes(2);
		expect(overlay).toHaveBeenCalledOnce();
		expect(lastOverlay).toHaveBeenCalledOnce();
		expect(menu).toHaveBeenCalledTimes(2);
		expect(modal).toHaveBeenCalledTimes(2);
		view.destroy();
	});

	it('draws registered render layers above sprites in registration order', async () => {
		const block = createMockCodeBlock({ x: 40, y: 96 });
		const state = createMockState({
			viewport: { x: 8, y: 16 },
			codeBlockRendering: { currentProject: { blocks: [block] } },
		});
		const memoryViews = createMemoryViews();
		const drawers = createEditorDrawerRegistry();
		const drawLayer = vi.fn();
		drawers.registerRenderLayer(() => ({ draw: drawLayer, destroy: vi.fn() }));
		const drawTopLayer = vi.fn();
		drawers.registerRenderLayer(() => ({ draw: drawTopLayer, destroy: vi.fn() }));
		const view = await init(createStateManager(state), createMockEventDispatcher(), memoryViews, { loading, drawers });
		view.renderFrame();

		expect(drawLayer).toHaveBeenCalledOnce();
		expect(mocks.drawCodeBlocks.mock.invocationCallOrder[0]).toBeLessThan(drawLayer.mock.invocationCallOrder[0]);
		expect(drawLayer.mock.invocationCallOrder[0]).toBeLessThan(drawTopLayer.mock.invocationCallOrder[0]);
		const first = mocks.drawCodeBlocks.mock.calls[0][4];
		const firstRecord = first.blocksByCodeBlock.get(block);
		expect(firstRecord).toMatchObject({ x: 32, y: 80 });
		expect(drawLayer.mock.calls[0][0].renderGeometry).toBe(first);
		expect(drawTopLayer.mock.calls[0][0].renderGeometry).toBe(first);

		state.viewport.x = 16;
		view.renderFrame();
		const next = mocks.drawCodeBlocks.mock.calls[1][4];
		expect(next).toBe(first);
		expect(next.blocksByCodeBlock.get(block)).toBe(firstRecord);
		expect(firstRecord).toMatchObject({ x: 24, y: 80 });
		expect(drawLayer.mock.calls[1][0].renderGeometry).toBe(next);
		expect(drawTopLayer.mock.calls[1][0].renderGeometry).toBe(next);
		view.destroy();
	});

	it('prepares one position effect per frame and shares displaced geometry without editing block positions', async () => {
		const block = createMockCodeBlock({ x: 40, y: 96 });
		const otherBlock = createMockCodeBlock({ x: 800, y: 96 });
		const state = createMockState({
			viewport: { x: 8, y: 16 },
			codeBlockRendering: { currentProject: { blocks: [block, otherBlock] } },
		});
		const drawers = createEditorDrawerRegistry();
		const drawBackground = vi.fn();
		const drawLayer = vi.fn();
		drawers.registerCanvasBackgroundDrawer(drawBackground);
		drawers.registerRenderLayer(() => ({ draw: drawLayer, destroy: vi.fn() }));
		const resolveOffset = vi.fn((candidate: typeof block) => (candidate === block ? { x: 6, y: -3 } : undefined));
		const effect = vi.fn(() => resolveOffset);
		const removePrevious = drawers.registerCodeBlockPositionEffect(effect);
		const remove = drawers.registerCodeBlockPositionEffect(effect);
		removePrevious();

		const view = await init(createStateManager(state), createMockEventDispatcher(), createMemoryViews(), {
			loading,
			drawers,
		});
		view.renderFrame(1250);

		expect(effect).toHaveBeenCalledExactlyOnceWith(state, 1250, false);
		expect(resolveOffset.mock.calls).toEqual([[block], [otherBlock]]);
		const geometry = mocks.drawCodeBlocks.mock.calls[0][4];
		const record = geometry.blocksByCodeBlock.get(block);
		expect(record).toMatchObject({ x: 38, y: 77 });
		expect(geometry.blocksByCodeBlock.get(otherBlock)).toMatchObject({ x: 792, y: 80 });
		expect(drawBackground.mock.calls[0][0].renderGeometry).toBe(geometry);
		expect(drawLayer.mock.calls[0][0].renderGeometry).toBe(geometry);
		expect(block).toMatchObject({ x: 40, y: 96 });
		expect(state.viewport).toMatchObject({ x: 8, y: 16 });

		remove();
		view.renderFrame(1270);

		expect(effect).toHaveBeenCalledOnce();
		expect(mocks.drawCodeBlocks.mock.calls[1][4]).toBe(geometry);
		expect(geometry.blocksByCodeBlock.get(block)).toBe(record);
		expect(record).toMatchObject({ x: 32, y: 80 });
		view.destroy();
	});

	it('shares a single visual camera without mutating the committed viewport or applying block springs', async () => {
		const block = createMockCodeBlock({ x: 180, y: 96 });
		const state = createMockState({
			viewport: { x: 24, y: 32 },
			codeBlockRendering: { currentProject: { blocks: [block] } },
		});
		const emitter = new EventEmitter();
		const events = {
			on: emitter.on.bind(emitter),
			off: emitter.off.bind(emitter),
			dispatch: vi.fn(emitter.emit.bind(emitter)),
		};
		const drawers = createEditorDrawerRegistry();
		const onBackground = vi.fn();
		const effect = vi.fn(() => () => ({ x: 12, y: 0 }));
		drawers.registerCanvasBackgroundDrawer(onBackground);
		drawers.registerCodeBlockPositionEffect(effect);
		const store = createStateManager(state);
		const view = await init(store, events, createMemoryViews(), { loading, drawers });
		const readViewportOrigin = mocks.BackgroundRenderer.mock.lastCall![1];
		state.viewport.x = 124;
		state.viewport.y = 72;
		events.dispatch('viewportChanged', { previousX: 24, previousY: 32, x: 124, y: 72, source: 'navigation' });
		events.dispatch.mockClear();
		view.renderFrame(1000);
		view.renderFrame(1100);
		const { viewport, renderGeometry } = onBackground.mock.lastCall![0];
		expect(viewport).toBe(readViewportOrigin());
		expect(viewport).toMatchObject({ x: 74, y: 52 });
		expect(renderGeometry.blocksByCodeBlock.get(block)).toMatchObject({ x: 106, y: 44 });
		expect(effect).toHaveBeenLastCalledWith(state, 1100, true);
		expect(state.viewport).toMatchObject({ x: 124, y: 72 });
		view.renderFrame(1200);
		expect(readViewportOrigin()).toMatchObject({ x: 124, y: 72 });
		expect(events.dispatch).not.toHaveBeenCalled();
		view.destroy();
		expect(emitter.listenerCount('viewportChanged')).toBe(0);
		store.dispose();
	});

	it('releases rendering resources and restores the latest deferred size before drawing', async () => {
		const state = createMockState();
		const memoryViews = createMemoryViews();
		const view = await init(createStateManager(state), createMockEventDispatcher(), memoryViews, { loading });

		view.releaseRenderingResources();
		view.releaseRenderingResources();

		expect(mocks.engine.releaseRenderingMemory).toHaveBeenCalledOnce();
		expect(mocks.engine.resize).toHaveBeenCalledExactlyOnceWith(1, 1);
		expect(view.resize(800, 600)).toBe(false);
		expect(mocks.engine.resize).toHaveBeenCalledTimes(1);

		view.renderFrame();

		expect(mocks.engine.restoreRenderingMemory).toHaveBeenCalledOnce();
		expect(mocks.engine.resize).toHaveBeenCalledTimes(2);
		expect(mocks.engine.resize).toHaveBeenLastCalledWith(800, 600);
		expect(mocks.engine.renderFrame).toHaveBeenCalledOnce();
		view.destroy();
	});

	it('retains the renderer’s initial drawing buffer size until the host supplies a size', async () => {
		const state = createMockState({ viewport: { width: 0, height: 0 } });
		const view = await init(createStateManager(state), createMockEventDispatcher(), createMemoryViews(), { loading });
		view.releaseRenderingResources();
		view.renderFrame();
		expect(mocks.engine.resize.mock.calls).toEqual([
			[1, 1],
			[640, 480],
		]);
		view.destroy();
	});

	it('updates palette independently of font atlas replacement', async () => {
		const state = createMockState();
		const store = createStateManager(state);
		const memoryViews = createMemoryViews();
		const drawers = createEditorDrawerRegistry();
		const loadPalette = vi.fn();
		drawers.registerRenderLayer(() => ({ draw: vi.fn(), destroy: vi.fn(), loadPalette }));
		const view = await init(store, createMockEventDispatcher(), memoryViews, {
			loading,
			drawers,
		});
		const paletteUploads = mocks.engine.setPalette.mock.calls.length;
		const backgroundPaletteUploads = mocks.background.setPalette.mock.calls.length;
		const atlasUploads = mocks.engine.setSpriteAtlas.mock.calls.length;
		store.set('editorConfig.font', 'terminus8x16');
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
		const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
		const state = createMockState();
		const store = createStateManager(state);
		const memoryViews = createMemoryViews();

		const view = await init(store, createMockEventDispatcher(), memoryViews, { loading });

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
		const onRenderStats = vi.fn();
		const view = await init(createStateManager(createMockState()), createMockEventDispatcher(), createMemoryViews(), {
			loading,
			onRenderStats,
			renderStatsIntervalFrames: 2,
		});
		try {
			mocks.drawCodeBlocks.mockImplementationOnce(() => {
				now += 20;
			});
			view.renderFrame();
			now = 1000;
			view.resetRenderStats();
			expect(mocks.engine.renderFrame).toHaveBeenCalledOnce();
			now = 1010;
			view.renderFrame();
			expect(onRenderStats).toHaveBeenCalledWith(
				expect.objectContaining({ fps: 100, frameBudgetMs: 10, p90RenderTimeMs: 0 })
			);
		} finally {
			view.destroy();
			performanceNow.mockRestore();
		}
	});

	it('emits render stats at the configured frame interval', async () => {
		let now = 0;
		const performanceNow = vi.spyOn(performance, 'now').mockImplementation(() => now);
		mocks.drawCodeBlocks.mockImplementationOnce(() => {
			now += 15;
		});
		const state = createMockState();
		const memoryViews = createMemoryViews();
		const onRenderStats = vi.fn();

		const view = await init(createStateManager(state), createMockEventDispatcher(), memoryViews, {
			loading,
			onRenderStats,
			renderStatsIntervalFrames: 2,
		});
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
			p90RenderTimeMs: 15,
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
