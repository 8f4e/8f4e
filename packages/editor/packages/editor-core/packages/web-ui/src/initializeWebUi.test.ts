import { EventEmitter } from 'node:events';
import { resolvePalette, toPaletteBytes } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockEventDispatcher, createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditorRenderRegistry } from './frame/renderRegistry';
import initWebUi from './initializeWebUi';

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
	return {
		engine,
		drawCodeBlocks: vi.fn(),
	};
});

vi.mock('./frame/drawCodeBlocks', () => ({
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
		const renderRegistry = createEditorRenderRegistry();
		renderRegistry.registerCanvasBackgroundDrawer(({ draw }) => draw.drawFill(4, 8, 0, 12, 16));
		const view = await init(createStateManager(createMockState()), createMockEventDispatcher(), createMemoryViews(), {
			loading,
			renderRegistry,
		});
		view.renderFrame();
		expect(mocks.engine.drawSprite).toHaveBeenCalledExactlyOnceWith(4, 8, 256, 0, 12, 16);
		view.destroy();
		expect(mocks.engine.destroy).toHaveBeenCalledOnce();
	});

	it('supplies the current presented viewport to a layer before sprite submission', async () => {
		const store = createStateManager(createMockState({ viewport: { x: -23, y: 12 } }));
		const renderRegistry = createEditorRenderRegistry();
		const draw = vi.fn();
		renderRegistry.registerRenderLayer('beforeSprites', () => ({ draw, destroy: vi.fn() }));
		const view = await init(store, createMockEventDispatcher(), createMemoryViews(), { loading, renderRegistry });
		view.renderFrame();
		expect(draw.mock.lastCall![0].viewport).toMatchObject({ x: -23, y: 12 });

		store.set('viewport', { ...store.getState().viewport, x: 44, y: -39 });
		view.renderFrame();
		expect(draw.mock.lastCall![0].viewport).toMatchObject({ x: 44, y: -39 });
		view.destroy();
		store.dispose();
	});

	it('loads the configured font and installs its grid before initializing render layers', async () => {
		const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
		const state = createMockState({
			editorConfig: { font: 'x11miscfixed6x10' },
			gridSizeReady: false,
			viewport: { vGrid: 0, hGrid: 0 },
		});
		const events = { ...createMockEventDispatcher(), dispatch: vi.fn() };
		events.dispatch.mockImplementation((name: string) => {
			if (name === 'gridSizeChanged') {
				expect(mocks.engine.setSpriteAtlas).toHaveBeenCalledOnce();
				expect(state.viewport).toMatchObject({ vGrid: 6, hGrid: 10 });
				expect(state.gridSizeReady).toBe(false);
			}
		});
		const renderRegistry = createEditorRenderRegistry();
		const factory = vi.fn(() => {
			expect(state.viewport).toMatchObject({ vGrid: 6, hGrid: 10 });
			expect(state.gridSizeReady).toBe(true);
			return { draw: vi.fn(), destroy: vi.fn() };
		});
		renderRegistry.registerRenderLayer('beforeSprites', factory);
		const atlas = createFontAtlas(6, 10);
		vi.mocked(loadFontAtlas).mockResolvedValueOnce(atlas);
		const view = await init(createStateManager(state), events, createMemoryViews(), {
			loading,
			renderRegistry,
			defaultFont: 'pixelcode6x12',
		});
		expect(loadFontAtlas).toHaveBeenCalledExactlyOnceWith('x11miscfixed6x10');
		expect(factory).toHaveBeenCalledExactlyOnceWith({
			gl: mocks.engine.gl,
			palette: resolvePalette(),
		});
		expect(events.dispatch.mock.calls).toEqual([['gridSizeChanged']]);
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
			renderRegistry: createEditorRenderRegistry(),
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
		view.destroy();
		store.dispose();
	});

	it('destroys the supplied renderer without attaching effects when the initial font fails', async () => {
		const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
		const error = new Error('Font unavailable');
		const state = createMockState({ gridSizeReady: false, viewport: { vGrid: 0, hGrid: 0 } });
		const events = { ...createMockEventDispatcher(), dispatch: vi.fn() };
		const renderRegistry = createEditorRenderRegistry();
		const factory = vi.fn();
		renderRegistry.registerRenderLayer('beforeSprites', factory);
		vi.mocked(loadFontAtlas).mockRejectedValueOnce(error);
		await expect(
			init(createStateManager(state), events, createMemoryViews(), { loading, renderRegistry })
		).rejects.toBe(error);
		expect(state.viewport).toMatchObject({ vGrid: 0, hGrid: 0 });
		expect(state.gridSizeReady).toBe(false);
		expect(events.dispatch).not.toHaveBeenCalled();
		expect(factory).not.toHaveBeenCalled();
		expect(mocks.engine.setSpriteAtlas).not.toHaveBeenCalled();
		expect(mocks.engine.destroy).toHaveBeenCalledOnce();
	});

	it('waits for the font selected by the prepared project before installing the grid or rendering', async () => {
		const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
		const state = createMockState({
			editorConfig: { font: 'spleen5x8' },
			gridSizeReady: false,
			viewport: { vGrid: 0, hGrid: 0 },
		});
		const store = createStateManager(state);
		const atlas = createFontAtlas(5, 8);
		const renderRegistry = createEditorRenderRegistry();
		const factory = vi.fn(() => ({ draw: vi.fn(), destroy: vi.fn() }));
		renderRegistry.registerRenderLayer('beforeSprites', factory);
		let finishFont!: (value: typeof atlas) => void;
		vi.mocked(loadFontAtlas).mockImplementationOnce(
			() =>
				new Promise(resolve => {
					finishFont = resolve;
				})
		);
		const mounting = init(store, createMockEventDispatcher(), createMemoryViews(), {
			loading,
			renderRegistry,
			defaultFont: 'pixelcode6x12',
		});
		expect(loadFontAtlas).toHaveBeenCalledExactlyOnceWith('spleen5x8');
		expect(factory).not.toHaveBeenCalled();
		expect(mocks.engine.setSpriteAtlas).not.toHaveBeenCalled();
		expect(state.gridSizeReady).toBe(false);
		expect(state.viewport).toMatchObject({ vGrid: 0, hGrid: 0 });
		finishFont(atlas);
		const view = await mounting;
		expect(state.viewport).toMatchObject({ vGrid: 5, hGrid: 8 });
		expect(state.gridSizeReady).toBe(true);
		expect(factory).toHaveBeenCalledExactlyOnceWith({
			gl: mocks.engine.gl,
			palette: resolvePalette(),
		});
		expect(mocks.engine.renderFrame).not.toHaveBeenCalled();
		view.renderFrame();
		expect(mocks.engine.renderFrame).toHaveBeenCalledOnce();
		view.destroy();
		store.dispose();
	});

	it('renders canvas backgrounds, blocks, and overlays in order with the current frame state', async () => {
		const state = createMockState();
		const memoryViews = createMemoryViews();

		const renderRegistry = createEditorRenderRegistry();
		const background = vi.fn();
		const removeBackground = renderRegistry.registerCanvasBackgroundDrawer(background);
		const overlay = vi.fn();
		const removeOverlay = renderRegistry.registerCanvasOverlay(overlay);
		const modal = vi.fn();
		const removeModal = renderRegistry.registerModalOverlay(modal);
		// Late registrations stay within their drawing stage, even when higher stages registered first.
		const menu = vi.fn();
		const removeMenu = renderRegistry.registerContextMenuOverlay(menu);
		const lastOverlay = vi.fn();
		const removeLastOverlay = renderRegistry.registerCanvasOverlay(lastOverlay);
		const view = await init(createStateManager(state), createMockEventDispatcher(), memoryViews, {
			loading,
			renderRegistry,
		});

		overlay.mockClear();
		background.mockClear();
		modal.mockClear();
		menu.mockClear();
		lastOverlay.mockClear();
		view.renderFrame();

		const [frame, registry] = mocks.drawCodeBlocks.mock.calls.at(-1)!;
		expect(registry).toBe(renderRegistry);
		expect(frame.state).toBe(state);
		expect(frame).toEqual({
			draw: expect.anything(),
			state,
			viewport: state.viewport,
			memoryViews,
			blockPositions: expect.anything(),
		});
		expect(background).toHaveBeenCalledWith(frame);
		expect(background.mock.invocationCallOrder[0]).toBeLessThan(mocks.drawCodeBlocks.mock.invocationCallOrder.at(-1)!);
		expect(mocks.drawCodeBlocks.mock.invocationCallOrder.at(-1)!).toBeLessThan(overlay.mock.invocationCallOrder[0]);
		expect(overlay).toHaveBeenCalledWith(frame);
		for (const drawer of [background, overlay, lastOverlay, menu, modal]) {
			expect(drawer.mock.calls[0][0]).toBe(frame);
		}
		expect(overlay.mock.invocationCallOrder[0]).toBeLessThan(lastOverlay.mock.invocationCallOrder[0]);
		expect(lastOverlay.mock.invocationCallOrder[0]).toBeLessThan(menu.mock.invocationCallOrder[0]);
		expect(menu.mock.invocationCallOrder[0]).toBeLessThan(modal.mock.invocationCallOrder[0]);
		state.featureFlags.canvasOverlays = false;
		view.renderFrame();
		expect(overlay).toHaveBeenCalledOnce();
		expect(lastOverlay).toHaveBeenCalledOnce();
		expect(menu).toHaveBeenCalledTimes(2);
		expect(background).toHaveBeenCalledTimes(2);
		expect(modal).toHaveBeenCalledTimes(2);
		state.featureFlags.canvasOverlays = true;
		removeBackground();
		removeOverlay();
		removeModal();
		removeMenu();
		removeLastOverlay();
		view.renderFrame();
		expect(background).toHaveBeenCalledTimes(2);
		expect(overlay).toHaveBeenCalledOnce();
		expect(lastOverlay).toHaveBeenCalledOnce();
		expect(menu).toHaveBeenCalledTimes(2);
		expect(modal).toHaveBeenCalledTimes(2);
		view.destroy();
	});

	it('draws registered render layers around sprites in stage and registration order', async () => {
		const block = createMockCodeBlock({ x: 40, y: 96 });
		const state = createMockState({
			viewport: { x: 8, y: 16 },
			project: { activeLevel: { blocks: [block] } },
		});
		const memoryViews = createMemoryViews();
		const renderRegistry = createEditorRenderRegistry();
		const drawAfter = vi.fn();
		renderRegistry.registerRenderLayer('afterSprites', () => ({ draw: drawAfter, destroy: vi.fn() }));
		const drawBefore = vi.fn();
		renderRegistry.registerRenderLayer('beforeSprites', () => ({ draw: drawBefore, destroy: vi.fn() }));
		const drawTopLayer = vi.fn();
		renderRegistry.registerRenderLayer('afterSprites', () => ({ draw: drawTopLayer, destroy: vi.fn() }));
		const drawNextBefore = vi.fn();
		renderRegistry.registerRenderLayer('beforeSprites', () => ({ draw: drawNextBefore, destroy: vi.fn() }));
		const view = await init(createStateManager(state), createMockEventDispatcher(), memoryViews, {
			loading,
			renderRegistry,
		});
		view.renderFrame();

		const layers = [drawBefore, drawNextBefore, drawAfter, drawTopLayer];
		for (const layer of layers) expect(layer).toHaveBeenCalledOnce();
		expect(drawBefore.mock.invocationCallOrder[0]).toBeLessThan(drawNextBefore.mock.invocationCallOrder[0]);
		expect(drawNextBefore.mock.invocationCallOrder[0]).toBeLessThan(mocks.drawCodeBlocks.mock.invocationCallOrder[0]);
		expect(mocks.drawCodeBlocks.mock.invocationCallOrder[0]).toBeLessThan(drawAfter.mock.invocationCallOrder[0]);
		expect(drawAfter.mock.invocationCallOrder[0]).toBeLessThan(drawTopLayer.mock.invocationCallOrder[0]);
		const first = mocks.drawCodeBlocks.mock.calls[0][0].blockPositions;
		const firstRecord = first.byCodeBlock.get(block);
		expect(firstRecord).toMatchObject({ x: 32, y: 80 });
		for (const layer of layers) {
			expect(layer.mock.calls[0][0]).toBe(drawBefore.mock.calls[0][0]);
			expect(layer.mock.calls[0][0].blockPositions).toBe(first);
		}

		state.viewport.x = 16;
		view.renderFrame();
		const next = mocks.drawCodeBlocks.mock.calls[1][0].blockPositions;
		expect(next).toBe(first);
		expect(next.byCodeBlock.get(block)).toBe(firstRecord);
		expect(firstRecord).toMatchObject({ x: 24, y: 80 });
		for (const layer of layers) expect(layer.mock.calls[1][0].blockPositions).toBe(next);
		view.destroy();
	});

	it('prepares one position effect per frame and shares displaced geometry without editing block positions', async () => {
		const block = createMockCodeBlock({ x: 40, y: 96 });
		const otherBlock = createMockCodeBlock({ x: 800, y: 96 });
		const state = createMockState({
			viewport: { x: 8, y: 16 },
			project: { activeLevel: { blocks: [block, otherBlock] } },
		});
		const renderRegistry = createEditorRenderRegistry();
		const drawBackground = vi.fn();
		const drawLayer = vi.fn();
		renderRegistry.registerCanvasBackgroundDrawer(drawBackground);
		renderRegistry.registerRenderLayer('beforeSprites', () => ({ draw: drawLayer, destroy: vi.fn() }));
		const resolveOffset = vi.fn((candidate: typeof block) => (candidate === block ? { x: 6, y: -3 } : undefined));
		const effect = vi.fn(() => resolveOffset);
		const removePrevious = renderRegistry.registerCodeBlockPositionEffect(effect);
		const remove = renderRegistry.registerCodeBlockPositionEffect(effect);
		removePrevious();

		const view = await init(createStateManager(state), createMockEventDispatcher(), createMemoryViews(), {
			loading,
			renderRegistry,
		});
		view.renderFrame(1250);

		expect(effect).toHaveBeenCalledExactlyOnceWith(state, 1250, false);
		expect(resolveOffset.mock.calls).toEqual([[block], [otherBlock]]);
		const geometry = mocks.drawCodeBlocks.mock.calls[0][0].blockPositions;
		const record = geometry.byCodeBlock.get(block);
		expect(record).toMatchObject({ x: 38, y: 77 });
		expect(geometry.byCodeBlock.get(otherBlock)).toMatchObject({ x: 792, y: 80 });
		expect(drawBackground.mock.calls[0][0].blockPositions).toBe(geometry);
		expect(drawLayer.mock.calls[0][0].blockPositions).toBe(geometry);
		expect(block).toMatchObject({ x: 40, y: 96 });
		expect(state.viewport).toMatchObject({ x: 8, y: 16 });

		remove();
		view.renderFrame(1270);

		expect(effect).toHaveBeenCalledOnce();
		expect(mocks.drawCodeBlocks.mock.calls[1][0].blockPositions).toBe(geometry);
		expect(geometry.byCodeBlock.get(block)).toBe(record);
		expect(record).toMatchObject({ x: 32, y: 80 });
		view.destroy();
	});

	it('shares a single visual camera without mutating the committed viewport or applying block springs', async () => {
		const block = createMockCodeBlock({ x: 180, y: 96 });
		const state = createMockState({
			viewport: { x: 24, y: 32 },
			project: { activeLevel: { blocks: [block] } },
		});
		const emitter = new EventEmitter();
		const events = {
			on: emitter.on.bind(emitter),
			off: emitter.off.bind(emitter),
			dispatch: vi.fn(emitter.emit.bind(emitter)),
		};
		const renderRegistry = createEditorRenderRegistry();
		const onBackground = vi.fn();
		const onLayer = vi.fn();
		const effect = vi.fn(() => () => ({ x: 12, y: 0 }));
		renderRegistry.registerRenderLayer('beforeSprites', () => ({ draw: onLayer, destroy: vi.fn() }));
		renderRegistry.registerCanvasBackgroundDrawer(onBackground);
		renderRegistry.registerCodeBlockPositionEffect(effect);
		const store = createStateManager(state);
		const view = await init(store, events, createMemoryViews(), { loading, renderRegistry });
		state.viewport.x = 124;
		state.viewport.y = 72;
		events.dispatch('viewportChanged', { previousX: 24, previousY: 32, x: 124, y: 72, source: 'navigation' });
		events.dispatch.mockClear();
		view.renderFrame(1000);
		view.renderFrame(1100);
		const { viewport, blockPositions } = onBackground.mock.lastCall![0];
		expect(viewport).toBe(onLayer.mock.lastCall![0].viewport);
		expect(blockPositions).toBe(onLayer.mock.lastCall![0].blockPositions);
		expect(viewport).toMatchObject({ x: 74, y: 52 });
		expect(blockPositions.byCodeBlock.get(block)).toMatchObject({ x: 106, y: 44 });
		expect(effect).toHaveBeenLastCalledWith(state, 1100, true);
		expect(state.viewport).toMatchObject({ x: 124, y: 72 });
		view.renderFrame(1200);
		expect(onLayer.mock.lastCall![0].viewport).toMatchObject({ x: 124, y: 72 });
		expect(events.dispatch).not.toHaveBeenCalled();
		view.destroy();
		expect(emitter.listenerCount('viewportChanged')).toBe(0);
		store.dispose();
	});

	it('releases rendering resources and restores the latest deferred size before drawing', async () => {
		const state = createMockState();
		const memoryViews = createMemoryViews();
		const view = await init(createStateManager(state), createMockEventDispatcher(), memoryViews, {
			loading,
			renderRegistry: createEditorRenderRegistry(),
		});

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
		const view = await init(createStateManager(state), createMockEventDispatcher(), createMemoryViews(), {
			loading,
			renderRegistry: createEditorRenderRegistry(),
		});
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
		const renderRegistry = createEditorRenderRegistry();
		const loadPalette = vi.fn();
		renderRegistry.registerRenderLayer('beforeSprites', () => ({ draw: vi.fn(), destroy: vi.fn(), loadPalette }));
		const view = await init(store, createMockEventDispatcher(), memoryViews, {
			loading,
			renderRegistry,
		});
		const paletteUploads = mocks.engine.setPalette.mock.calls.length;
		const atlasUploads = mocks.engine.setSpriteAtlas.mock.calls.length;
		store.set('editorConfig.font', 'terminus8x16');
		await vi.waitFor(() => expect(mocks.engine.setSpriteAtlas).toHaveBeenCalledTimes(atlasUploads + 1));
		expect(mocks.engine.setPalette).toHaveBeenCalledTimes(paletteUploads);
		expect(loadPalette).not.toHaveBeenCalled();

		const installCount = mocks.engine.setSpriteAtlas.mock.calls.length;
		const palette = resolvePalette({ primary: '#00ff00' });
		store.set('editorConfig.color', { primary: '#00ff00' });
		expect(mocks.engine.setPalette).toHaveBeenLastCalledWith(toPaletteBytes(palette));
		expect(loadPalette).toHaveBeenCalledExactlyOnceWith(palette);
		expect(mocks.engine.setSpriteAtlas).toHaveBeenCalledTimes(installCount);
		view.destroy();
		store.dispose();
	});

	it('supplies the installed grid through the presented viewport while a replacement atlas is pending', async () => {
		const { default: loadFontAtlas } = await import('@8f4e/sprite-generator');
		const state = createMockState();
		const store = createStateManager(state);
		const memoryViews = createMemoryViews();
		const renderRegistry = createEditorRenderRegistry();
		const drawBefore = vi.fn();
		const loadPalette = vi.fn();
		renderRegistry.registerRenderLayer('beforeSprites', () => ({ draw: drawBefore, destroy: vi.fn(), loadPalette }));
		const view = await init(store, createMockEventDispatcher(), memoryViews, { loading, renderRegistry });
		view.renderFrame();
		expect(drawBefore.mock.lastCall![0].viewport).toMatchObject({ vGrid: 8, hGrid: 16 });

		const atlas = createFontAtlas(10, 18);
		let finishFont!: (value: typeof atlas) => void;
		vi.mocked(loadFontAtlas).mockImplementationOnce(
			() =>
				new Promise(resolve => {
					finishFont = resolve;
				})
		);
		store.set('editorConfig.font', 'terminus10x18');
		const drawAfter = vi.fn();
		const pendingFactory = vi.fn(() => ({ draw: drawAfter, destroy: vi.fn() }));
		renderRegistry.registerRenderLayer('afterSprites', pendingFactory);
		expect(pendingFactory).toHaveBeenCalledExactlyOnceWith({
			gl: mocks.engine.gl,
			palette: resolvePalette(),
		});
		expect(state.gridSizeReady).toBe(false);
		const replacementPalette = resolvePalette({ primary: '#00ff00' });
		store.set('editorConfig.color', { primary: '#00ff00' });
		expect(loadPalette).toHaveBeenCalledExactlyOnceWith(replacementPalette);
		expect(mocks.engine.setPalette).toHaveBeenLastCalledWith(toPaletteBytes(replacementPalette));
		view.renderFrame();
		expect(drawBefore.mock.lastCall![0]).toBe(drawAfter.mock.lastCall![0]);
		expect(drawAfter.mock.lastCall![0].viewport).toMatchObject({ vGrid: 8, hGrid: 16 });
		finishFont(atlas);
		await vi.waitFor(() => expect(mocks.engine.setSpriteAtlas).toHaveBeenLastCalledWith(atlas.image, atlas.grid));
		expect(state.viewport).toMatchObject({ vGrid: 10, hGrid: 18 });
		expect(state.gridSizeReady).toBe(true);
		expect(loadPalette).toHaveBeenCalledOnce();
		expect(mocks.engine.setPalette).toHaveBeenCalledTimes(2);
		view.renderFrame();
		expect(drawBefore.mock.lastCall![0]).toBe(drawAfter.mock.lastCall![0]);
		expect(drawAfter.mock.lastCall![0].viewport).toMatchObject({ vGrid: 10, hGrid: 18 });
		view.destroy();
		store.dispose();
	});

	it('restarts FPS sampling when the host resumes after a pause without drawing', async () => {
		let now = 0;
		const performanceNow = vi.spyOn(performance, 'now').mockImplementation(() => now);
		const onRenderStats = vi.fn();
		const view = await init(createStateManager(createMockState()), createMockEventDispatcher(), createMemoryViews(), {
			loading,
			renderRegistry: createEditorRenderRegistry(),
			onRenderStats,
		});
		try {
			view.renderFrame();
			now = 1000;
			view.resetRenderStats();
			expect(mocks.engine.renderFrame).toHaveBeenCalledOnce();
			for (let frame = 1; frame < 60; frame++) {
				now += 10;
				view.renderFrame();
			}
			expect(onRenderStats).not.toHaveBeenCalled();
			now += 10;
			view.renderFrame();
			expect(onRenderStats).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ fps: 100, frameBudgetMs: 10 }));
		} finally {
			view.destroy();
			performanceNow.mockRestore();
		}
	});

	it('emits render stats every 60 frames', async () => {
		let now = 0;
		const performanceNow = vi.spyOn(performance, 'now').mockImplementation(() => now);
		const state = createMockState();
		const memoryViews = createMemoryViews();
		const onRenderStats = vi.fn();

		const view = await init(createStateManager(state), createMockEventDispatcher(), memoryViews, {
			loading,
			renderRegistry: createEditorRenderRegistry(),
			onRenderStats,
		});
		try {
			for (let frame = 1; frame < 60; frame++) {
				now += 25;
				view.renderFrame();
			}
			expect(onRenderStats).not.toHaveBeenCalled();

			now += 15;
			mocks.drawCodeBlocks.mockImplementationOnce(() => {
				now += 10;
			});
			view.renderFrame();
			expect(onRenderStats).toHaveBeenCalledExactlyOnceWith({
				timeToRenderMs: 10,
				fps: 40,
				frameBudgetMs: 25,
				headroomMs: 15,
				fpsCapacity: 100,
				spriteCount: 100,
				uploadedInstanceBytes: 2000,
			});

			for (let frame = 1; frame < 60; frame++) {
				now += 20;
				view.renderFrame();
			}
			expect(onRenderStats).toHaveBeenCalledTimes(1);
			now += 20;
			view.renderFrame();
			expect(onRenderStats).toHaveBeenCalledTimes(2);
			expect(onRenderStats).toHaveBeenLastCalledWith(expect.objectContaining({ fps: 50, frameBudgetMs: 20 }));
		} finally {
			view.destroy();
			performanceNow.mockRestore();
		}
	});
});
