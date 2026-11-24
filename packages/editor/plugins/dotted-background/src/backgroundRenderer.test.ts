import { PALETTE_INDICES, resolvePalette } from '@8f4e/editor-palette';
import initState, { setGridSize } from '@8f4e/editor-state';
import { createMockEventDispatcher } from '@8f4e/editor-state-testing';
import { createEditorRenderRegistry, type MemoryViews } from '@8f4e/web-ui';
import { describe, expect, it, vi } from 'vitest';
import BackgroundRenderer from './backgroundRenderer';
import { dottedBackgroundPlugin } from './index';

function createGl() {
	let id = 0;
	const resource = () => ({ id: ++id });
	const gl = {
		drawingBufferWidth: 321,
		drawingBufferHeight: 197,
		VERTEX_SHADER: 0x8b31,
		FRAGMENT_SHADER: 0x8b30,
		COMPILE_STATUS: 0x8b81,
		LINK_STATUS: 0x8b82,
		FRAMEBUFFER: 0x8d40,
		BLEND: 0x0be2,
		FUNC_ADD: 0x8006,
		ONE: 1,
		ONE_MINUS_SRC_ALPHA: 0x0303,
		SCISSOR_TEST: 0x0c11,
		DEPTH_TEST: 0x0b71,
		STENCIL_TEST: 0x0b90,
		CULL_FACE: 0x0b44,
		RASTERIZER_DISCARD: 0x8c89,
		TRIANGLES: 4,
		createShader: vi.fn(resource),
		shaderSource: vi.fn(),
		compileShader: vi.fn(),
		getShaderParameter: vi.fn(() => true),
		getShaderInfoLog: vi.fn(() => 'shader failed'),
		deleteShader: vi.fn(),
		createProgram: vi.fn(resource),
		attachShader: vi.fn(),
		linkProgram: vi.fn(),
		getProgramParameter: vi.fn(() => true),
		getProgramInfoLog: vi.fn(() => 'link failed'),
		deleteProgram: vi.fn(),
		createVertexArray: vi.fn<() => object | null>(resource),
		deleteVertexArray: vi.fn(),
		getUniformLocation: vi.fn((_program: unknown, name: string): { name: string } | null => ({ name })),
		bindFramebuffer: vi.fn(),
		viewport: vi.fn(),
		useProgram: vi.fn(),
		bindVertexArray: vi.fn(),
		enable: vi.fn(),
		disable: vi.fn(),
		blendEquation: vi.fn(),
		blendFunc: vi.fn(),
		colorMask: vi.fn(),
		uniform2f: vi.fn(),
		uniform4f: vi.fn(),
		uniform4fv: vi.fn(),
		drawArrays: vi.fn(),
	};
	return { gl, context: gl as unknown as WebGL2RenderingContext };
}

function palette(base: number[], even: number[], odd: number[]): Uint8Array {
	const bytes = new Uint8Array(256 * 4);
	bytes.set(base, PALETTE_INDICES.canvasBase * 4);
	bytes.set(even, PALETTE_INDICES.canvasDetail2 * 4);
	bytes.set(odd, PALETTE_INDICES.canvasDetail1 * 4);
	return bytes;
}

const grid = { vGrid: 8, hGrid: 16 };

describe('procedural background', () => {
	it('draws one triangle, updating dot bounds only when the grid changes', () => {
		const { context, gl } = createGl();
		const background = new BackgroundRenderer(context);
		background.setPalette(palette([20, 30, 40, 102], [99, 99, 99, 255], [58, 58, 58, 255]));
		background.draw({ x: 0, y: 0, ...grid });
		expect(gl.drawArrays).toHaveBeenLastCalledWith(gl.TRIANGLES, 0, 3);
		expect(gl.uniform2f).toHaveBeenCalledWith({ name: 'u_patternOffset' }, 0, 0);
		expect(gl.uniform2f).toHaveBeenLastCalledWith({ name: 'u_patternScale' }, 321 / 16, 197 / 16);
		expect(gl.uniform4f).toHaveBeenCalledWith({ name: 'u_dotBounds' }, 3 / 8, 7 / 16, 5 / 8, 9 / 16);
		expect(gl.bindFramebuffer).toHaveBeenCalledWith(gl.FRAMEBUFFER, null);
		expect(gl.blendFunc).toHaveBeenCalledWith(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.drawingBufferWidth = 800;
		gl.drawingBufferHeight = 601;
		background.draw({ x: 9, y: 3, ...grid });
		expect(gl.viewport).toHaveBeenLastCalledWith(0, 0, 800, 601);
		expect(gl.uniform2f).toHaveBeenCalledWith({ name: 'u_patternOffset' }, 9 / 16, 3 / 16);
		expect(gl.uniform2f).toHaveBeenLastCalledWith({ name: 'u_patternScale' }, 800 / 16, 601 / 16);
		expect(gl.uniform4f).toHaveBeenCalledOnce();
		background.draw({ x: 0, y: 0, vGrid: 5, hGrid: 16 });
		expect(gl.uniform4f).toHaveBeenCalledTimes(2);
		expect(gl.uniform4f).toHaveBeenLastCalledWith({ name: 'u_dotBounds' }, 2 / 5, 7 / 16, 3 / 5, 8 / 16);
		background.draw({ x: 0, y: 0, vGrid: 5, hGrid: 8 });
		expect(gl.uniform2f).toHaveBeenLastCalledWith({ name: 'u_patternScale' }, 80, 601 / 8);
		expect(gl.uniform4f).toHaveBeenCalledTimes(3);
		expect(gl.uniform4f).toHaveBeenLastCalledWith({ name: 'u_dotBounds' }, 2 / 5, 3 / 8, 3 / 5, 4 / 8);
		background.destroy();
	});

	it.each([
		[8, 16, 3, 7, 2],
		[7, 9, 2, 3, 2],
		[5, 8, 2, 3, 1],
		[1, 1, 0, 0, 1],
		[2, 7, 0, 3, 1],
		[21, 6, 9, 2, 2],
		[10, 18, 3, 7, 3],
		[33, 61, 12, 26, 8],
	])('centers a square in a %i×%i pixel grid cell', (vGrid, hGrid, x, y, size) => {
		const { context, gl } = createGl();
		const background = new BackgroundRenderer(context);
		background.setPalette(palette([20, 30, 40, 255], [99, 99, 99, 255], [58, 58, 58, 255]));
		background.draw({ x: 0, y: 0, vGrid, hGrid });
		expect(gl.uniform4f).toHaveBeenCalledExactlyOnceWith(
			{ name: 'u_dotBounds' },
			x / vGrid,
			y / hGrid,
			(x + size) / vGrid,
			(y + size) / hGrid
		);
		background.destroy();
	});

	it('reads the current viewport on every draw and wraps over a complete alternating pattern', () => {
		const { context, gl } = createGl();
		let origin = { x: 9, y: 3 };
		const background = new BackgroundRenderer(context);
		background.setPalette(palette([20, 30, 40, 255], [99, 99, 99, 255], [58, 58, 58, 255]));
		background.draw({ ...origin, ...grid });
		expect(gl.uniform2f).toHaveBeenCalledWith({ name: 'u_patternOffset' }, 9 / 16, 3 / 16);

		origin = { x: -1_000_000_000_009, y: 1_000_000_000_019 };
		gl.uniform2f.mockClear();
		background.draw({ ...origin, ...grid });
		expect(gl.uniform2f).toHaveBeenCalledWith({ name: 'u_patternOffset' }, -9 / 16, 3 / 16);

		gl.uniform2f.mockClear();
		background.draw({ ...origin, vGrid: 5, hGrid: 8 });
		expect(gl.uniform2f).toHaveBeenCalledWith({ name: 'u_patternOffset' }, -9 / 10, 3 / 8);
		background.destroy();
	});

	it('uploads composited colors only on palette changes and skips an invisible background', () => {
		const { context, gl } = createGl();
		const background = new BackgroundRenderer(context);
		background.setPalette(palette([0, 0, 255, 128], [255, 0, 0, 128], [0, 0, 0, 0]));
		expect(gl.useProgram).toHaveBeenCalledExactlyOnceWith(gl.createProgram.mock.results[0].value);
		expect(gl.useProgram.mock.invocationCallOrder[0]).toBeLessThan(gl.uniform4fv.mock.invocationCallOrder[0]);
		expect(gl.uniform4fv).toHaveBeenCalledTimes(3);
		expect(gl.drawArrays).not.toHaveBeenCalled();
		const uploaded = (name: string) => [...gl.uniform4fv.mock.calls.find(([location]) => location.name === name)![1]];
		expect(uploaded('u_baseColor')).toEqual([0, 0, expect.closeTo(128 / 255), expect.closeTo(128 / 255)]);
		expect(uploaded('u_evenColor')).toEqual([
			expect.closeTo(128 / 255),
			0,
			expect.closeTo((128 * 127) / (255 * 255)),
			expect.closeTo(1 - (127 / 255) ** 2),
		]);
		expect(uploaded('u_oddColor')).toEqual(uploaded('u_baseColor'));
		background.draw({ x: 0, y: 0, ...grid });
		background.draw({ x: 9, y: 3, ...grid });
		expect(gl.uniform4fv).toHaveBeenCalledTimes(3);
		expect(gl.drawArrays).toHaveBeenCalledTimes(2);
		background.setPalette(new Uint8Array(256 * 4));
		expect(gl.uniform4fv).toHaveBeenCalledTimes(6);
		gl.drawArrays.mockClear();
		background.draw({ x: 0, y: 0, ...grid });
		expect(gl.drawArrays).not.toHaveBeenCalled();
		expect(gl.uniform4fv).toHaveBeenCalledTimes(6);
		background.destroy();
	});

	it('deletes resources exactly once', () => {
		const { context, gl } = createGl();
		const background = new BackgroundRenderer(context);
		background.destroy();
		background.destroy();
		expect(gl.deleteProgram).toHaveBeenCalledOnce();
		expect(gl.deleteVertexArray).toHaveBeenCalledOnce();
	});

	it.each(['fragment', 'link', 'vertex-array', 'uniform'] as const)('cleans up failed %s setup', failure => {
		const { context, gl } = createGl();
		if (failure === 'fragment') gl.getShaderParameter.mockReturnValueOnce(true).mockReturnValueOnce(false);
		if (failure === 'link') gl.getProgramParameter.mockReturnValue(false);
		if (failure === 'vertex-array') gl.createVertexArray.mockReturnValue(null);
		if (failure === 'uniform') gl.getUniformLocation.mockReturnValue(null);
		expect(() => new BackgroundRenderer(context)).toThrow();
		expect(gl.deleteShader).toHaveBeenCalledTimes(2);
		expect(gl.deleteProgram).toHaveBeenCalledTimes(failure === 'fragment' ? 0 : 1);
		expect(gl.deleteVertexArray).toHaveBeenCalledTimes(failure === 'uniform' ? 1 : 0);
	});
});

it('registers an optional before-sprites layer that tracks the presented viewport grid and palette', () => {
	const { context, gl } = createGl();
	const events = createMockEventDispatcher();
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	setGridSize(state, events, { vGrid: 8, hGrid: 16 });
	Object.assign(state.viewport, { x: 100, y: 200 });
	const frame = {
		state,
		viewport: { ...state.viewport, x: 9, y: 3 },
		memoryViews: {} as MemoryViews,
		blockPositions: { ordered: [], byCodeBlock: new Map() },
	};
	const renderRegistry = createEditorRenderRegistry();
	const services = {
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		renderRegistry,
	};
	const dispose = dottedBackgroundPlugin.setup(services);
	expect(gl.createProgram).not.toHaveBeenCalled();
	const layers = renderRegistry.attachRenderLayers({
		gl: context,
		palette: resolvePalette({ canvas: '#1a334c' }),
	});
	expect(gl.uniform4fv).toHaveBeenCalledWith(
		{ name: 'u_baseColor' },
		new Float32Array([26 / 255, 51 / 255, 76 / 255, 1])
	);

	gl.uniform4fv.mockClear();
	layers.draw('afterSprites', frame);
	expect(gl.drawArrays).not.toHaveBeenCalled();
	layers.draw('beforeSprites', frame);
	expect(gl.drawArrays).toHaveBeenCalledOnce();
	expect(gl.uniform2f).toHaveBeenCalledWith({ name: 'u_patternOffset' }, 9 / 16, 3 / 16);
	expect(gl.uniform4f).toHaveBeenCalledWith({ name: 'u_dotBounds' }, 3 / 8, 7 / 16, 5 / 8, 9 / 16);
	expect(gl.uniform4fv).not.toHaveBeenCalled();

	layers.loadPalette(resolvePalette({ canvas: '#182030' }));
	expect(gl.uniform4fv).toHaveBeenCalledWith(
		{ name: 'u_baseColor' },
		new Float32Array([24 / 255, 32 / 255, 48 / 255, 1])
	);
	frame.viewport.x = 23;
	frame.viewport.y = 9;
	frame.viewport.vGrid = 5;
	frame.viewport.hGrid = 8;
	gl.uniform2f.mockClear();
	gl.uniform4fv.mockClear();
	layers.draw('beforeSprites', frame);
	expect(gl.uniform2f).toHaveBeenCalledWith({ name: 'u_patternOffset' }, 3 / 10, 1 / 8);
	expect(gl.uniform4f).toHaveBeenLastCalledWith({ name: 'u_dotBounds' }, 2 / 5, 3 / 8, 3 / 5, 4 / 8);
	expect(gl.uniform4fv).not.toHaveBeenCalled();

	dispose();
	gl.drawArrays.mockClear();
	layers.draw('beforeSprites', frame);
	expect(gl.drawArrays).not.toHaveBeenCalled();
	expect(gl.deleteProgram).toHaveBeenCalledOnce();
	expect(gl.deleteVertexArray).toHaveBeenCalledOnce();

	const disposeReplacement = dottedBackgroundPlugin.setup(services);
	expect(gl.uniform4fv).toHaveBeenCalledWith(
		{ name: 'u_baseColor' },
		new Float32Array([24 / 255, 32 / 255, 48 / 255, 1])
	);
	gl.uniform2f.mockClear();
	gl.uniform4fv.mockClear();
	layers.draw('beforeSprites', frame);
	expect(gl.drawArrays).toHaveBeenCalledOnce();
	expect(gl.uniform2f).toHaveBeenCalledWith({ name: 'u_patternOffset' }, 3 / 10, 1 / 8);
	expect(gl.uniform4f).toHaveBeenLastCalledWith({ name: 'u_dotBounds' }, 2 / 5, 3 / 8, 3 / 5, 4 / 8);
	expect(gl.uniform4fv).not.toHaveBeenCalled();
	disposeReplacement();
	layers.destroy();
	expect(gl.deleteProgram).toHaveBeenCalledTimes(2);
	expect(gl.deleteVertexArray).toHaveBeenCalledTimes(2);
	store.dispose();
});
