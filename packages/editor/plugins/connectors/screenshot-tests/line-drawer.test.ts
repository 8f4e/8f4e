import { Engine } from 'glugglugglug';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { LineDrawer } from '../src/line-drawer';

type Point = readonly [number, number];

describe('Bresenham wires', () => {
	let canvas: HTMLCanvasElement;
	let engine: Engine;
	let lines: LineDrawer;

	beforeAll(() => {
		canvas = document.createElement('canvas');
		canvas.width = 32;
		canvas.height = 32;
		engine = new Engine(canvas);
		lines = new LineDrawer(engine.gl);
	});

	afterAll(() => {
		lines.destroy();
		engine.destroy();
	});

	const endpoints: Array<[name: string, end: Point]> = [
		['horizontal right', [28, 16]],
		['shallow down-right', [28, 20]],
		['half-slope down-right', [28, 22]],
		['near-diagonal down-right', [28, 27]],
		['diagonal down-right', [28, 28]],
		['near-diagonal steep down-right', [27, 28]],
		['double-slope down-right', [22, 28]],
		['steep down-right', [20, 28]],
		['vertical down', [16, 28]],
		['steep down-left', [12, 28]],
		['diagonal down-left', [4, 28]],
		['shallow down-left', [4, 20]],
		['horizontal left', [4, 16]],
		['shallow up-left', [4, 12]],
		['diagonal up-left', [4, 4]],
		['steep up-left', [12, 4]],
		['vertical up', [16, 4]],
		['steep up-right', [20, 4]],
		['diagonal up-right', [28, 4]],
		['shallow up-right', [28, 12]],
		['coincident endpoints', [16, 16]],
	];
	const cases: Array<{ name: string; from: Point; to: Point }> = endpoints.map(([name, to]) => ({
		name,
		from: [16, 16],
		to,
	}));
	cases.push(
		{ name: 'clipped endpoints', from: [-12, -4], to: [45, 31] },
		{ name: 'fractional endpoints', from: [12.4, 8.6], to: [26.6, 21.4] },
		{ name: 'large offscreen endpoints', from: [-40_000, -20_000], to: [40_000, 20_000] }
	);

	describe.each(cases)('$name', ({ from, to }) => {
		test.each(
			[1, 2, 3].flatMap(thickness => [
				{ direction: 'forward', thickness, from, to },
				{ direction: 'reversed', thickness, from: to, to: from },
			])
		)('$direction with width $thickness matches the integer reference', ({ from, to, thickness }) => {
			const expected = rasterizeReference(from, to, thickness, canvas.width, canvas.height);
			engine.renderFrame(() => {
				lines.reset();
				lines.drawLine(...from, ...to, thickness, [1, 1, 1, 1]);
				lines.flush();
			});
			const actual = new Uint8Array(canvas.width * canvas.height * 4);
			engine.gl.readPixels(0, 0, canvas.width, canvas.height, engine.gl.RGBA, engine.gl.UNSIGNED_BYTE, actual);
			expect(occupiedPixels(actual, canvas.width)).toEqual(occupiedPixels(expected, canvas.width));
			expect(engine.gl.getError()).toBe(engine.gl.NO_ERROR);
		});
	});
});

function occupiedPixels(pixels: Uint8Array, width: number): string[] {
	const occupied: string[] = [];
	const height = pixels.length / (width * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const offset = ((height - 1 - y) * width + x) * 4;
			if (pixels[offset + 3]) occupied.push(`${x},${y}:${pixels.slice(offset, offset + 4)}`);
		}
	}
	return occupied;
}

/** Independent integer-error Bresenham reference, clipped only after choosing the full line's pixels. */
function rasterizeReference(from: Point, to: Point, thickness: number, width: number, height: number): Uint8Array {
	let start = from.map(Math.round);
	let end = to.map(Math.round);
	const xMajor = Math.abs(end[0] - start[0]) >= Math.abs(end[1] - start[1]);
	if (!xMajor) {
		start.reverse();
		end.reverse();
	}
	if (start[0] > end[0]) [start, end] = [end, start];
	const majorLength = end[0] - start[0];
	const minorLength = Math.abs(end[1] - start[1]);
	const minorDirection = Math.sign(end[1] - start[1]);
	let minor = start[1];
	let error = 2 * minorLength - majorLength;
	const pixels = new Uint8Array(width * height * 4);
	for (let major = start[0]; major <= end[0]; major++) {
		for (let offset = -Math.floor(thickness / 2); offset < Math.ceil(thickness / 2); offset++) {
			const [x, y] = xMajor ? [major, minor + offset] : [minor + offset, major];
			if (x >= 0 && x < width && y >= 0 && y < height) {
				const offset = ((height - 1 - y) * width + x) * 4;
				pixels.fill(255, offset, offset + 4);
			}
		}
		if (error >= 0) {
			minor += minorDirection;
			error -= 2 * majorLength;
		}
		error += 2 * minorLength;
	}
	return pixels;
}
