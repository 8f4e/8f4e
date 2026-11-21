import { Engine } from 'glugglugglug';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { createSlackWireDrawer } from '../src/slack-wire-drawer';

describe('pixelated slack wire shader', () => {
	const size = 64;
	let engine: Engine;
	let drawer: ReturnType<typeof createSlackWireDrawer>;
	beforeAll(() => {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = size;
		engine = new Engine(canvas);
		drawer = createSlackWireDrawer(engine.gl);
	});
	afterAll(() => {
		drawer.destroy();
		engine.destroy();
	});

	function render(x1: number, y1: number, x2: number, y2: number, slack = 0.25) {
		const gl = engine.gl;
		const draw = vi.spyOn(gl, 'drawArraysInstanced');
		try {
			engine.renderFrame(() => {
				drawer.reset();
				drawer.drawWire(x1, y1, x2, y2, 1, [1, 1, 1, 0.5]);
				drawer.flush(slack);
			});
			// The GPU receives a single instance even when the wire curves.
			expect(draw).toHaveBeenLastCalledWith(gl.TRIANGLES, 0, expect.any(Number), 1);
		} finally {
			draw.mockRestore();
		}
		const pixels = new Uint8Array(size * size * 4);
		gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		expect(gl.getError()).toBe(gl.NO_ERROR);
		return (x: number, y: number) => pixels[((size - 1 - y) * size + x) * 4 + 3];
	}

	test.each([
		[4, 28],
		[28, 4],
	])('draws a continuous translucent sag from x=%i to x=%i without dark joins', (startX, endX) => {
		const alphaAt = render(startX, 8, endX, 8);
		expect(alphaAt(startX, 8)).toBe(128);
		expect(alphaAt(endX, 8)).toBe(128);
		expect(alphaAt(16, 14)).toBe(128);
		expect(alphaAt(16, 8)).toBe(0);
		for (let x = 4; x <= 28; x++) {
			const column = Array.from({ length: size }, (_, y) => alphaAt(x, y)).filter(alpha => alpha !== 0);
			expect(column).toEqual([128]);
		}
	});

	test.each([
		{ slack: 0, midpointY: 8 },
		{ slack: 0.5, midpointY: 20 },
	])('uses the supplied slack ratio $slack without moving the endpoints', ({ slack, midpointY }) => {
		const alphaAt = render(4, 8, 28, 8, slack);
		expect(alphaAt(4, 8)).toBe(128);
		expect(alphaAt(28, 8)).toBe(128);
		expect(alphaAt(16, midpointY)).toBe(128);
		expect(alphaAt(16, 14)).toBe(0);
	});

	test('keeps vertical wires pixel-aligned after GPU memory release', () => {
		drawer.releaseMemory();
		const alphaAt = render(20, 24, 20, 4);
		for (let y = 4; y <= 24; y++) expect(alphaAt(20, y)).toBe(128);
		expect(alphaAt(21, 12)).toBe(0);
	});

	test('caps the sag of wires whose connectors are far offscreen', () => {
		const alphaAt = render(-40_000, -70, 40_064, -70);
		expect(alphaAt(32, 26)).toBe(128);
		expect(alphaAt(32, 27)).toBe(0);
	});
});
