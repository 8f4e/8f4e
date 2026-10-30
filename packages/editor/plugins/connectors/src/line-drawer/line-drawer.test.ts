import { describe, expect, it } from 'vitest';
import { createFakeWebGl } from '../__tests__/fake-webgl';
import { LineDrawer } from './line-drawer';
import { LINE_INSTANCE_BYTE_STRIDE } from './line-instance';

describe('LineDrawer', () => {
	it.each([0, -1, 0.5, 1.5, NaN, Infinity, -Infinity])(
		'rejects invalid pixel thickness %s before queuing',
		thickness => {
			const gl = createFakeWebGl();
			const lines = new LineDrawer(gl);

			lines.reset();
			expect(() => lines.drawLine(0, 0, 10, 10, thickness, [1, 1, 1, 1])).toThrow(
				new RangeError('thickness must be a positive integer number of pixels.')
			);
			lines.flush();
			expect(gl.bufferSubData).not.toHaveBeenCalled();
			expect(gl.drawArraysInstanced).not.toHaveBeenCalled();
		}
	);

	it('draws compact ordered line instances once', () => {
		const gl = createFakeWebGl();
		const lines = new LineDrawer(gl, { initialCapacity: 1 });

		lines.reset();
		lines.drawLine(1, 2, 11, 12, 3, [1, 0.5, 0, 0.25]);
		lines.drawLine(20, 21, 30, 31, 4, [0, 1, 0, 1]);
		lines.flush();

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
		const gl = createFakeWebGl();
		const lines = new LineDrawer(gl);

		lines.reset();
		lines.drawLine(0, 0, 10, 10, 1, [1, 1, 1, 1]);
		lines.flush();
		expect(gl.drawArraysInstanced).toHaveBeenCalledOnce();

		gl.drawArraysInstanced.mockClear();
		gl.bufferSubData.mockClear();
		lines.reset();
		lines.flush();
		expect(gl.bufferSubData).not.toHaveBeenCalled();
		expect(gl.drawArraysInstanced).not.toHaveBeenCalled();
	});

	it('releases dynamic buffer storage and reallocates it on the next non-empty frame', () => {
		const gl = createFakeWebGl();
		const lines = new LineDrawer(gl, { initialCapacity: 2 });
		gl.bufferData.mockClear();

		lines.releaseMemory();
		lines.releaseMemory();

		expect(gl.bufferData).toHaveBeenCalledOnce();
		expect(gl.bufferData).toHaveBeenCalledWith(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW);

		lines.reset();
		lines.drawLine(0, 0, 10, 10, 1, [1, 1, 1, 1]);
		lines.flush();

		expect(gl.bufferData).toHaveBeenCalledTimes(2);
		expect(gl.bufferData).toHaveBeenLastCalledWith(gl.ARRAY_BUFFER, 2 * LINE_INSTANCE_BYTE_STRIDE, gl.DYNAMIC_DRAW);
	});

	it('reuses upload views and limits used ranges after growth, empty frames, and memory release', () => {
		const gl = createFakeWebGl();
		const lines = new LineDrawer(gl, { initialCapacity: 1 });
		const render = (count: number): Uint8Array | undefined => {
			gl.bufferSubData.mockClear();
			lines.reset();
			for (let i = 0; i < count; i++) lines.drawLine(i, 0, i + 1, 1, 1, [1, 0.5, 0, 0.25]);
			lines.flush();
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

	it('deletes only its own resources idempotently', () => {
		const gl = createFakeWebGl();
		const lines = new LineDrawer(gl);

		lines.destroy();
		lines.destroy();

		expect(gl.deleteBuffer).toHaveBeenCalledOnce();
		expect(gl.deleteVertexArray).toHaveBeenCalledOnce();
		expect(gl.deleteProgram).toHaveBeenCalledOnce();
	});
});
