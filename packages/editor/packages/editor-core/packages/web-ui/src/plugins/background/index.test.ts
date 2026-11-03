import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { RenderHook, RenderPluginHost } from 'glugglugglug';
import { describe, expect, it, vi } from 'vitest';
import BackgroundRenderer from './index';

function createHost() {
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
		uniform4fv: vi.fn(),
		drawArrays: vi.fn(),
	};
	const host: RenderPluginHost = {
		gl: gl as unknown as WebGL2RenderingContext,
		hooks: { preDraw: [], postDraw: [] },
	};
	return { host, gl, draw: () => host.hooks.preDraw.forEach(hook => hook(host.gl)) };
}

function palette(base: number[], even: number[], odd: number[]): Uint8Array {
	const bytes = new Uint8Array(256 * 4);
	bytes.set(base, PALETTE_INDICES.canvasBase * 4);
	bytes.set(even, PALETTE_INDICES.canvasDetail2 * 4);
	bytes.set(odd, PALETTE_INDICES.canvasDetail1 * 4);
	return bytes;
}

const grid = { cellWidth: 8, cellHeight: 16 };

describe('procedural background', () => {
	it('draws one triangle and follows font and drawing-buffer size changes', () => {
		const { host, gl, draw } = createHost();
		const background = new BackgroundRenderer(host);
		background.setFont('ibmvga8x16', grid);
		background.setPalette(palette([20, 30, 40, 102], [99, 99, 99, 255], [58, 58, 58, 255]));
		draw();
		expect(gl.drawArrays).toHaveBeenLastCalledWith(gl.TRIANGLES, 0, 3);
		expect(gl.uniform2f).toHaveBeenLastCalledWith({ name: 'u_patternScale' }, 321 / 16, 197 / 16);
		expect(gl.uniform4fv).toHaveBeenCalledWith(
			{ name: 'u_dotBounds' },
			new Float32Array([3 / 8, 7 / 16, 5 / 8, 9 / 16])
		);
		expect(gl.bindFramebuffer).toHaveBeenCalledWith(gl.FRAMEBUFFER, null);
		expect(gl.blendFunc).toHaveBeenCalledWith(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		background.setFont('spleen5x8', { cellWidth: 5, cellHeight: 8 });
		gl.drawingBufferWidth = 800;
		gl.drawingBufferHeight = 601;
		draw();
		expect(gl.viewport).toHaveBeenLastCalledWith(0, 0, 800, 601);
		expect(gl.uniform2f).toHaveBeenLastCalledWith({ name: 'u_patternScale' }, 80, 601 / 8);
		background.destroy();
	});

	it('composites translucent dots over the base before drawing and skips an invisible background', () => {
		const { host, gl, draw } = createHost();
		const background = new BackgroundRenderer(host);
		background.setFont('ibmvga8x16', grid);
		background.setPalette(palette([0, 0, 255, 128], [255, 0, 0, 128], [0, 0, 0, 0]));
		draw();
		const uploaded = (name: string) => [...gl.uniform4fv.mock.calls.find(([location]) => location.name === name)![1]];
		expect(uploaded('u_baseColor')).toEqual([0, 0, expect.closeTo(128 / 255), expect.closeTo(128 / 255)]);
		expect(uploaded('u_evenColor')).toEqual([
			expect.closeTo(128 / 255),
			0,
			expect.closeTo((128 * 127) / (255 * 255)),
			expect.closeTo(1 - (127 / 255) ** 2),
		]);
		expect(uploaded('u_oddColor')).toEqual(uploaded('u_baseColor'));
		background.setPalette(new Uint8Array(256 * 4));
		gl.drawArrays.mockClear();
		draw();
		expect(gl.drawArrays).not.toHaveBeenCalled();
		background.destroy();
	});

	it('detaches its own hook and deletes resources exactly once', () => {
		const { host, gl } = createHost();
		const other: RenderHook = vi.fn();
		host.hooks.preDraw.push(other);
		const background = new BackgroundRenderer(host);
		expect(host.hooks.preDraw).toHaveLength(2);
		background.destroy();
		background.destroy();
		expect(host.hooks.preDraw).toEqual([other]);
		expect(gl.deleteProgram).toHaveBeenCalledOnce();
		expect(gl.deleteVertexArray).toHaveBeenCalledOnce();
	});

	it.each(['fragment', 'link', 'vertex-array', 'uniform'] as const)('cleans up failed %s setup', failure => {
		const { host, gl } = createHost();
		if (failure === 'fragment') gl.getShaderParameter.mockReturnValueOnce(true).mockReturnValueOnce(false);
		if (failure === 'link') gl.getProgramParameter.mockReturnValue(false);
		if (failure === 'vertex-array') gl.createVertexArray.mockReturnValue(null);
		if (failure === 'uniform') gl.getUniformLocation.mockReturnValue(null);
		expect(() => new BackgroundRenderer(host)).toThrow();
		expect(host.hooks.preDraw).toHaveLength(0);
		expect(gl.deleteShader).toHaveBeenCalledTimes(2);
		expect(gl.deleteProgram).toHaveBeenCalledTimes(failure === 'fragment' ? 0 : 1);
		expect(gl.deleteVertexArray).toHaveBeenCalledTimes(failure === 'uniform' ? 1 : 0);
	});
});
