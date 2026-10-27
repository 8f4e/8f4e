import { resolvePalette } from '@8f4e/editor-palette';
import { createMockState } from '@8f4e/editor-state-testing';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import type { WebUiRenderDataSource } from '@8f4e/web-ui-render-projection';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renderDataSnapshot = { codeBlocks: new Map() };
const renderData: WebUiRenderDataSource = { getSnapshot: () => renderDataSnapshot };

const mocks = vi.hoisted(() => {
	let overlayTextureDrawCallback: ((layer: unknown) => void) | undefined;
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
	const overlayTextureLayer = {
		setDrawCallback: vi.fn((callback: (layer: unknown) => void) => {
			overlayTextureDrawCallback = callback;
		}),
		uploadRgba8Texture: vi.fn(),
		drawTexture: vi.fn(),
		releaseMemory: vi.fn(),
		destroy: vi.fn(() => {
			overlayTextureDrawCallback = undefined;
		}),
	};
	const lines = {
		drawLine: vi.fn(),
		releaseMemory: vi.fn(),
		destroy: vi.fn(),
	};
	const background = { setFont: vi.fn(), setPalette: vi.fn(), destroy: vi.fn() };
	const wireColors = {
		wire: [0.1, 0.2, 0.3, 1] as const,
		wireHighlighted: [0.4, 0.5, 0.6, 1] as const,
	};
	const resolveWireColors = vi.fn(() => wireColors);
	const requestAnimationFrame = vi.fn(() => 23);
	const cancelAnimationFrame = vi.fn();

	return {
		engine,
		overlayTextureLayer,
		lines,
		background,
		wireColors,
		resolveWireColors,
		requestAnimationFrame,
		cancelAnimationFrame,
		// biome-ignore lint/complexity/useArrowFunction: Engine is constructed with new in the code under test.
		Engine: vi.fn(function () {
			engine.hooks.preDraw.length = 0;
			engine.hooks.postDraw.length = 0;
			overlayTextureDrawCallback = undefined;
			return engine;
		}),
		// biome-ignore lint/complexity/useArrowFunction: Plugins are constructed with new in the code under test.
		RgbaTextureLayer: vi.fn(function () {
			engine.hooks.postDraw.push(() => overlayTextureDrawCallback?.(overlayTextureLayer));
			return overlayTextureLayer;
		}),
		// biome-ignore lint/complexity/useArrowFunction: Plugins are constructed with new in the code under test.
		LineDrawer: vi.fn(function () {
			return lines;
		}),
		// biome-ignore lint/complexity/useArrowFunction: The background renderer is constructed with new.
		BackgroundRenderer: vi.fn(function () {
			return background;
		}),
		drawCodeBlocks: vi.fn(),
		drawConnections: vi.fn(),
		drawContextMenu: vi.fn(),
		drawDialog: vi.fn(),
		drawModeOverlay: vi.fn(),
	};
});

vi.mock('glugglugglug', () => ({
	Engine: mocks.Engine,
}));

vi.mock('./plugins/line-drawer', () => ({ LineDrawer: mocks.LineDrawer }));
vi.mock('./plugins/rgba-texture-layer', () => ({ RgbaTextureLayer: mocks.RgbaTextureLayer }));

vi.mock('./plugins/background', () => ({
	default: mocks.BackgroundRenderer,
}));

vi.mock('./drawers/codeBlocks', () => ({
	default: mocks.drawCodeBlocks,
}));

vi.mock('./drawers/codeBlocks/widgets/connections', () => ({
	default: mocks.drawConnections,
}));

vi.mock('./drawers/contextMenu', () => ({
	default: mocks.drawContextMenu,
}));

vi.mock('./drawers/dialog', () => ({
	default: mocks.drawDialog,
}));

vi.mock('./drawers/modeOverlay', () => ({
	default: mocks.drawModeOverlay,
}));

vi.mock('./wire-colors', () => ({
	resolveWireColors: mocks.resolveWireColors,
}));

function createMemory(overrides: Partial<PlannedMemoryDeclaration> = {}): PlannedMemoryDeclaration {
	return {
		id: 'rgba',
		numberOfElements: 1,
		elementWordSize: 4,
		type: 'int' as const,
		byteAddress: 0,
		elementByteLength: 4,
		allocationUnitCount: 1,
		allocatedByteLength: 4,
		allocationUnitAddress: 0,
		endByteAddress: 0,
		endAddressSafeByteLength: 4,
		lineNumber: 1,
		isInteger: true,
		pointerDepth: 0,
		isUnsigned: false,
		...overrides,
	};
}

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

describe('web-ui init', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('requestAnimationFrame', mocks.requestAnimationFrame);
		vi.stubGlobal('cancelAnimationFrame', mocks.cancelAnimationFrame);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('renders one frame with the current state on demand', async () => {
		const { default: init } = await import('./index');
		const state = createMockState();
		const memoryViews = {
			int8: new Int8Array(0),
			int16: new Int16Array(0),
			int32: new Int32Array(0),
			uint8: new Uint8Array(0),
			uint16: new Uint16Array(0),
			float32: new Float32Array(0),
			float64: new Float64Array(0),
		};

		const view = await init(
			state,
			renderData,
			{} as HTMLCanvasElement,
			memoryViews,
			createFontAtlas(),
			resolvePalette(state.editorConfig.color)
		);

		view.renderFrame();

		const frameState = mocks.drawCodeBlocks.mock.calls.at(-1)?.[1];
		const frameRenderData = mocks.drawCodeBlocks.mock.calls.at(-1)?.[3];

		expect(frameState).toBe(state);
		expect(frameRenderData).toBe(renderDataSnapshot);
		expect(mocks.resolveWireColors).toHaveBeenCalledWith(resolvePalette(state.editorConfig.color));
		expect(mocks.drawConnections).toHaveBeenCalledWith(mocks.lines, mocks.wireColors, frameState, memoryViews);
		expect(mocks.drawModeOverlay).toHaveBeenCalledWith(expect.anything(), frameState);
	});

	it('does not construct overlay rendering resources when no overlay is configured', async () => {
		const { default: init } = await import('./index');
		const state = createMockState();
		const memoryViews = {
			int8: new Int8Array(0),
			int16: new Int16Array(0),
			int32: new Int32Array(0),
			uint8: new Uint8Array(0),
			uint16: new Uint16Array(0),
			float32: new Float32Array(0),
			float64: new Float64Array(0),
		};

		const view = await init(
			state,
			renderData,
			{} as HTMLCanvasElement,
			memoryViews,
			createFontAtlas(),
			resolvePalette(state.editorConfig.color)
		);
		view.renderFrame();

		expect(mocks.RgbaTextureLayer).not.toHaveBeenCalled();
	});

	it('registers a configured overlay after the line renderer', async () => {
		const { default: init } = await import('./index');
		const state = createMockState();
		const memoryViews = {
			int8: new Int8Array(0),
			int16: new Int16Array(0),
			int32: new Int32Array(0),
			uint8: new Uint8Array(0),
			uint16: new Uint16Array(0),
			float32: new Float32Array(0),
			float64: new Float64Array(0),
		};
		await init(
			state,
			renderData,
			{} as HTMLCanvasElement,
			memoryViews,
			createFontAtlas(),
			resolvePalette(state.editorConfig.color),
			{
				overlayTexture: {
					entry: 'renderFrame',
					target: 'screen:rgba',
					width: 1,
					height: 1,
				},
				getCodeBuffer: () => new Uint8Array(0),
				getMemory: () => null,
			}
		);

		expect(mocks.RgbaTextureLayer).toHaveBeenCalledWith(mocks.engine);
		expect(mocks.LineDrawer.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.RgbaTextureLayer.mock.invocationCallOrder[0]
		);
	});

	it('hides wires while a dialog is visible and restores them when it closes', async () => {
		const { default: init } = await import('./index');
		const state = createMockState({
			dialogStack: [{ id: 'permission', title: 'Permission', text: 'Allow audio?', buttons: [] }],
		});
		const memoryViews = {
			int8: new Int8Array(0),
			int16: new Int16Array(0),
			int32: new Int32Array(0),
			uint8: new Uint8Array(0),
			uint16: new Uint16Array(0),
			float32: new Float32Array(0),
			float64: new Float64Array(0),
		};
		const view = await init(
			state,
			renderData,
			{} as HTMLCanvasElement,
			memoryViews,
			createFontAtlas(),
			resolvePalette(state.editorConfig.color)
		);

		expect(mocks.drawConnections).not.toHaveBeenCalled();

		state.dialogStack = [];
		view.renderFrame();

		expect(mocks.drawConnections).toHaveBeenCalledWith(mocks.lines, mocks.wireColors, state, memoryViews);
	});

	it('pauses and resumes its animation frame loop idempotently', async () => {
		const { default: init } = await import('./index');
		const state = createMockState();
		const memoryViews = {
			int8: new Int8Array(0),
			int16: new Int16Array(0),
			int32: new Int32Array(0),
			uint8: new Uint8Array(0),
			uint16: new Uint16Array(0),
			float32: new Float32Array(0),
			float64: new Float64Array(0),
		};
		const view = await init(
			state,
			renderData,
			{} as HTMLCanvasElement,
			memoryViews,
			createFontAtlas(),
			resolvePalette(state.editorConfig.color)
		);
		expect(mocks.engine.renderFrame).toHaveBeenCalledOnce();
		expect(mocks.requestAnimationFrame).toHaveBeenCalledOnce();

		view.pauseRendering();
		view.pauseRendering();
		expect(mocks.cancelAnimationFrame).toHaveBeenCalledOnce();
		expect(mocks.cancelAnimationFrame).toHaveBeenCalledWith(23);

		view.resumeRendering();
		view.resumeRendering();
		expect(mocks.engine.renderFrame).toHaveBeenCalledTimes(2);
		expect(mocks.requestAnimationFrame).toHaveBeenCalledTimes(2);

		view.destroy();
		expect(mocks.cancelAnimationFrame).toHaveBeenCalledTimes(2);
		expect(mocks.background.destroy).toHaveBeenCalledOnce();
		expect(mocks.engine.destroy).toHaveBeenCalledOnce();
	});

	it('releases rendering resources and applies the latest deferred size when resumed', async () => {
		const { default: init } = await import('./index');
		const state = createMockState();
		const memoryViews = {
			int8: new Int8Array(0),
			int16: new Int16Array(0),
			int32: new Int32Array(0),
			uint8: new Uint8Array(0),
			uint16: new Uint16Array(0),
			float32: new Float32Array(0),
			float64: new Float64Array(0),
		};
		const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
		const view = await init(
			state,
			renderData,
			canvas,
			memoryViews,
			createFontAtlas(),
			resolvePalette(state.editorConfig.color)
		);

		view.releaseRenderingResources();
		view.releaseRenderingResources();

		expect(mocks.cancelAnimationFrame).toHaveBeenCalledOnce();
		expect(mocks.overlayTextureLayer.releaseMemory).not.toHaveBeenCalled();
		expect(mocks.lines.releaseMemory).toHaveBeenCalledOnce();
		expect(mocks.engine.releaseRenderingMemory).toHaveBeenCalledOnce();
		expect(canvas).toEqual(expect.objectContaining({ width: 1, height: 1 }));
		expect(view.resize(800, 600)).toBe(false);
		expect(mocks.engine.resize).not.toHaveBeenCalled();

		view.resumeRendering();

		expect(mocks.engine.restoreRenderingMemory).toHaveBeenCalledOnce();
		expect(mocks.engine.resize).toHaveBeenCalledOnce();
		expect(mocks.engine.resize).toHaveBeenCalledWith(800, 600);
		expect(mocks.engine.renderFrame).toHaveBeenCalledTimes(2);
	});

	it('updates palette and wire colors independently of font atlas replacement', async () => {
		const { default: init } = await import('./index');
		const state = createMockState();
		const memoryViews = {
			int8: new Int8Array(0),
			int16: new Int16Array(0),
			int32: new Int32Array(0),
			uint8: new Uint8Array(0),
			uint16: new Uint16Array(0),
			float32: new Float32Array(0),
			float64: new Float64Array(0),
		};
		const view = await init(
			state,
			renderData,
			{} as HTMLCanvasElement,
			memoryViews,
			createFontAtlas(),
			resolvePalette(state.editorConfig.color)
		);
		const paletteUploads = mocks.engine.setPalette.mock.calls.length;
		const backgroundPaletteUploads = mocks.background.setPalette.mock.calls.length;
		const wireUpdates = mocks.resolveWireColors.mock.calls.length;
		view.loadFontAtlas(createFontAtlas(), 'ibmvga8x16');
		expect(mocks.engine.setPalette).toHaveBeenCalledTimes(paletteUploads);
		expect(mocks.background.setPalette).toHaveBeenCalledTimes(backgroundPaletteUploads);
		expect(mocks.resolveWireColors).toHaveBeenCalledTimes(wireUpdates);

		const installCount = mocks.engine.setSpriteAtlas.mock.calls.length;
		const palette = resolvePalette({ primary: '#00ff00' });
		view.loadPalette(palette);
		expect(mocks.background.setPalette).toHaveBeenCalledWith(mocks.engine.setPalette.mock.calls.at(-1)?.[0]);
		expect(mocks.engine.setSpriteAtlas).toHaveBeenCalledTimes(installCount);

		expect(mocks.resolveWireColors).toHaveBeenLastCalledWith(palette);
	});

	it('updates font dimensions and background settings when the atlas is replaced', async () => {
		const { default: init } = await import('./index');
		const state = createMockState();
		const memoryViews = {
			int8: new Int8Array(0),
			int16: new Int16Array(0),
			int32: new Int32Array(0),
			uint8: new Uint8Array(0),
			uint16: new Uint16Array(0),
			float32: new Float32Array(0),
			float64: new Float64Array(0),
		};

		const view = await init(
			state,
			renderData,
			{} as HTMLCanvasElement,
			memoryViews,
			createFontAtlas(8, 16),
			resolvePalette(state.editorConfig.color)
		);

		view.loadFontAtlas(createFontAtlas(10, 18), 'terminus10x18');
		expect(mocks.background.setFont).toHaveBeenLastCalledWith('terminus10x18', createFontAtlas(10, 18).grid);
		expect(mocks.engine.setSpriteAtlas).toHaveBeenLastCalledWith(
			createFontAtlas(10, 18).image,
			createFontAtlas(10, 18).grid
		);
	});

	it('emits render stats at the configured frame interval', async () => {
		let now = 0;
		const performanceNow = vi.spyOn(performance, 'now').mockImplementation(() => {
			now += 10;
			return now;
		});
		const { default: init } = await import('./index');
		const state = createMockState();
		const memoryViews = {
			int8: new Int8Array(0),
			int16: new Int16Array(0),
			int32: new Int32Array(0),
			uint8: new Uint8Array(0),
			uint16: new Uint16Array(0),
			float32: new Float32Array(0),
			float64: new Float64Array(0),
		};
		const onRenderStats = vi.fn();

		const view = await init(
			state,
			renderData,
			{} as HTMLCanvasElement,
			memoryViews,
			createFontAtlas(),
			resolvePalette(state.editorConfig.color),
			{
				onRenderStats,
				renderStatsIntervalFrames: 2,
			}
		);
		expect(onRenderStats).not.toHaveBeenCalled();

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
		performanceNow.mockRestore();
	});

	it('can draw a WebAssembly-generated RGBA8 overlay texture', async () => {
		const { default: init } = await import('./index');
		const state = createMockState();
		const rgba = createMemory({
			byteAddress: 4,
			allocationUnitAddress: 1,
			endByteAddress: 4,
		});
		state.compiler.memoryPlan = {
			modules: {
				screen: {
					id: 'screen',
					lineNumber: 1,
					byteAddress: 4,
					allocationUnitCount: 1,
					allocatedByteLength: 4,
					endByteAddress: 4,
					endAddressSafeByteLength: 4,
					memory: {
						rgba,
					},
					declarations: [rgba],
					declarationSources: [],
				},
			},
			moduleList: [],
		};
		const memoryBuffer = new ArrayBuffer(24);
		const memoryViews = {
			int8: new Int8Array(memoryBuffer),
			int16: new Int16Array(memoryBuffer),
			int32: new Int32Array(memoryBuffer),
			uint8: new Uint8Array(memoryBuffer),
			uint16: new Uint16Array(memoryBuffer),
			float32: new Float32Array(memoryBuffer),
			float64: new Float64Array(memoryBuffer),
		};
		memoryViews.uint8.set([1, 2, 3, 4, 5, 6, 7, 8], 4);
		const memory = { buffer: memoryBuffer } as WebAssembly.Memory;
		const codeBuffer = new Uint8Array([1, 2, 3]);
		const renderFrameExport = vi.fn(() => {
			memoryViews.uint8.set([10, 20, 30, 255], 4);
		});
		const instantiateOverlayTextureWasm = vi.fn(async () => ({ renderFrame: renderFrameExport }));
		const canvas = { width: 160, height: 90 } as HTMLCanvasElement;

		const view = await init(
			state,
			renderData,
			canvas,
			memoryViews,
			createFontAtlas(),
			resolvePalette(state.editorConfig.color),
			{
				getCodeBuffer: () => codeBuffer,
				getMemory: () => memory,
				instantiateOverlayTextureWasm,
			}
		);

		view.renderFrame();
		expect(instantiateOverlayTextureWasm).not.toHaveBeenCalled();

		view.setOverlayTexture({
			entry: 'renderFrame',
			target: 'screen:rgba',
			width: 1,
			height: 1,
			magnification: 32,
			position: 'left',
		});
		expect(instantiateOverlayTextureWasm).not.toHaveBeenCalled();

		view.renderFrame();

		expect(instantiateOverlayTextureWasm).toHaveBeenCalledWith(memory, codeBuffer);
		expect(renderFrameExport).not.toHaveBeenCalled();
		await Promise.resolve();
		view.resize(320, 180);
		view.renderFrame();

		expect(renderFrameExport).toHaveBeenCalledTimes(1);
		expect(mocks.overlayTextureLayer.uploadRgba8Texture).toHaveBeenCalledWith(expect.any(Uint8Array), 1, 1);
		const data = mocks.overlayTextureLayer.uploadRgba8Texture.mock.calls.at(-1)?.[0] as Uint8Array;
		expect([...data]).toEqual([10, 20, 30, 255]);
		expect(mocks.overlayTextureLayer.drawTexture).toHaveBeenCalledWith(64, 74, 32, 32);

		view.releaseRenderingResources();
		expect(mocks.overlayTextureLayer.releaseMemory).toHaveBeenCalledOnce();
		view.resumeRendering();

		view.setOverlayTexture(undefined);
		expect(mocks.overlayTextureLayer.destroy).toHaveBeenCalledOnce();
	});
});
