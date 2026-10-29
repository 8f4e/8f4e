import type { RenderHooks } from 'glugglugglug';
import { describe, expect, it, vi } from 'vitest';
import { LineDrawer } from './line-drawer';
import { LINE_INSTANCE_BYTE_STRIDE } from './line-instance-buffer';

type FakeWebGl = ReturnType<typeof createFakeWebGl>;

describe('LineDrawer', () => {
	it('attaches to both frame hooks and draws compact ordered line instances once', () => {
		const { gl, hooks } = createHost();
		const lines = new LineDrawer({ gl, hooks }, { initialCapacity: 1 });
		expect(hooks.preDraw).toHaveLength(1);
		expect(hooks.postDraw).toHaveLength(1);

		hooks.preDraw[0](gl);
		lines.drawLine(1, 2, 11, 12, 3, [1, 0.5, 0, 0.25]);
		lines.drawLine(20, 21, 30, 31, 4, [0, 1, 0, 1]);
		hooks.postDraw[0](gl);

		expect(gl.createBuffer).toHaveBeenCalledOnce();
		expect(gl.bufferData).toHaveBeenCalledTimes(2);
		expect(gl.bufferData).toHaveBeenLastCalledWith(gl.ARRAY_BUFFER, 2 * LINE_INSTANCE_BYTE_STRIDE, gl.DYNAMIC_DRAW);
		expect(gl.bufferSubData).toHaveBeenCalledOnce();
		const bytes = gl.bufferSubData.mock.calls[0][2] as Uint8Array;
		expect(gl.bufferSubData).toHaveBeenCalledWith(gl.ARRAY_BUFFER, 0, bytes, 0, 2 * LINE_INSTANCE_BYTE_STRIDE);
		expect(bytes.byteLength).toBe(2 * LINE_INSTANCE_BYTE_STRIDE);
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		expect([0, 1, 2, 3, 4].map(index => view.getFloat32(index * 4, true))).toEqual([1, 2, 11, 12, 3]);
		expect(Array.from(bytes.slice(20, 24))).toEqual([255, 128, 0, 64]);
		expect([0, 1, 2, 3, 4].map(index => view.getFloat32(LINE_INSTANCE_BYTE_STRIDE + index * 4, true))).toEqual([
			20, 21, 30, 31, 4,
		]);
		expect(gl.drawArraysInstanced).toHaveBeenCalledWith(gl.TRIANGLE_STRIP, 0, 4, 2);
	});

	it('resets its write cursor at the start of every frame', () => {
		const { gl, hooks } = createHost();
		const lines = new LineDrawer({ gl, hooks });

		hooks.preDraw[0](gl);
		lines.drawLine(0, 0, 10, 10, 1, [1, 1, 1, 1]);
		hooks.postDraw[0](gl);
		expect(gl.drawArraysInstanced).toHaveBeenCalledOnce();

		gl.drawArraysInstanced.mockClear();
		gl.bufferSubData.mockClear();
		hooks.preDraw[0](gl);
		hooks.postDraw[0](gl);
		expect(gl.bufferSubData).not.toHaveBeenCalled();
		expect(gl.drawArraysInstanced).not.toHaveBeenCalled();
	});

	it('releases dynamic buffer storage and reallocates it on the next non-empty frame', () => {
		const { gl, hooks } = createHost();
		const lines = new LineDrawer({ gl, hooks }, { initialCapacity: 2 });
		gl.bufferData.mockClear();

		lines.releaseMemory();
		lines.releaseMemory();

		expect(gl.bufferData).toHaveBeenCalledOnce();
		expect(gl.bufferData).toHaveBeenCalledWith(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW);

		hooks.preDraw[0](gl);
		lines.drawLine(0, 0, 10, 10, 1, [1, 1, 1, 1]);
		hooks.postDraw[0](gl);

		expect(gl.bufferData).toHaveBeenCalledTimes(2);
		expect(gl.bufferData).toHaveBeenLastCalledWith(gl.ARRAY_BUFFER, 2 * LINE_INSTANCE_BYTE_STRIDE, gl.DYNAMIC_DRAW);
	});

	it('reuses upload views and limits used ranges after growth, empty frames, and memory release', () => {
		const { gl, hooks } = createHost();
		const lines = new LineDrawer({ gl, hooks }, { initialCapacity: 1 });
		const render = (count: number): Uint8Array | undefined => {
			gl.bufferSubData.mockClear();
			hooks.preDraw[0](gl);
			for (let i = 0; i < count; i++) lines.drawLine(i, 0, i + 1, 1, 1, [1, 0.5, 0, 0.25]);
			hooks.postDraw[0](gl);
			if (count === 0) {
				expect(gl.bufferSubData).not.toHaveBeenCalled();
				return undefined;
			}
			expect(gl.bufferSubData).toHaveBeenCalledOnce();
			const bytes = gl.bufferSubData.mock.calls[0][2] as Uint8Array;
			expect(gl.bufferSubData).toHaveBeenCalledWith(gl.ARRAY_BUFFER, 0, bytes, 0, count * LINE_INSTANCE_BYTE_STRIDE);
			return bytes;
		};

		const initial = render(1);
		expect(render(1)).toBe(initial);
		const grown = render(3);
		expect(grown).not.toBe(initial);
		expect(grown?.byteLength).toBe(4 * LINE_INSTANCE_BYTE_STRIDE);
		expect(render(1)).toBe(grown);
		render(0);
		lines.releaseMemory();
		render(0);
		expect(render(2)).toBe(grown);
	});

	it('detaches and deletes only its own resources idempotently', () => {
		const { gl, hooks } = createHost();
		const lines = new LineDrawer({ gl, hooks });

		lines.destroy();
		lines.destroy();

		expect(hooks.preDraw).toEqual([]);
		expect(hooks.postDraw).toEqual([]);
		expect(gl.deleteBuffer).toHaveBeenCalledOnce();
		expect(gl.deleteVertexArray).toHaveBeenCalledOnce();
		expect(gl.deleteProgram).toHaveBeenCalledOnce();
	});
});

/** Creates a hook host backed by a focused fake WebGL2 context. */
function createHost(): { gl: FakeWebGl; hooks: RenderHooks } {
	return {
		gl: createFakeWebGl(),
		hooks: { preDraw: [], postDraw: [] },
	};
}

/** Creates the WebGL2 surface used by the line-plugin unit tests. */
function createFakeWebGl() {
	let resourceId = 0;
	/** Returns one distinguishable fake GPU resource. */
	const resource = (kind: string) => ({ kind, id: ++resourceId });
	return {
		drawingBufferWidth: 320,
		drawingBufferHeight: 200,
		VERTEX_SHADER: 0x8b31,
		FRAGMENT_SHADER: 0x8b30,
		COMPILE_STATUS: 0x8b81,
		LINK_STATUS: 0x8b82,
		ARRAY_BUFFER: 0x8892,
		DYNAMIC_DRAW: 0x88e8,
		FLOAT: 0x1406,
		UNSIGNED_BYTE: 0x1401,
		FRAMEBUFFER: 0x8d40,
		BLEND: 0x0be2,
		SCISSOR_TEST: 0x0c11,
		DEPTH_TEST: 0x0b71,
		STENCIL_TEST: 0x0b90,
		CULL_FACE: 0x0b44,
		RASTERIZER_DISCARD: 0x8c89,
		FUNC_ADD: 0x8006,
		ONE: 1,
		ONE_MINUS_SRC_ALPHA: 0x0303,
		TRIANGLE_STRIP: 0x0005,
		createShader: vi.fn(() => resource('shader')),
		shaderSource: vi.fn(),
		compileShader: vi.fn(),
		getShaderParameter: vi.fn(() => true),
		getShaderInfoLog: vi.fn(() => null),
		deleteShader: vi.fn(),
		createProgram: vi.fn(() => resource('program')),
		attachShader: vi.fn(),
		linkProgram: vi.fn(),
		getProgramParameter: vi.fn(() => true),
		getProgramInfoLog: vi.fn(() => null),
		deleteProgram: vi.fn(),
		createBuffer: vi.fn(() => resource('buffer')),
		deleteBuffer: vi.fn(),
		createVertexArray: vi.fn(() => resource('vertex-array')),
		deleteVertexArray: vi.fn(),
		getUniformLocation: vi.fn((_program: unknown, name: string) => ({ name })),
		useProgram: vi.fn(),
		bindVertexArray: vi.fn(),
		bindBuffer: vi.fn(),
		bufferData: vi.fn(),
		bufferSubData: vi.fn(),
		enableVertexAttribArray: vi.fn(),
		vertexAttribPointer: vi.fn(),
		vertexAttribDivisor: vi.fn(),
		bindFramebuffer: vi.fn(),
		viewport: vi.fn(),
		enable: vi.fn(),
		disable: vi.fn(),
		blendEquation: vi.fn(),
		blendFunc: vi.fn(),
		colorMask: vi.fn(),
		uniform2f: vi.fn(),
		drawArraysInstanced: vi.fn(),
	} as unknown as WebGL2RenderingContext & {
		[key: string]: ReturnType<typeof vi.fn> | number;
	};
}
