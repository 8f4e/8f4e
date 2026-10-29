import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import { LineDrawer } from '../src/plugins/line-drawer';

type Point = readonly [number, number];

test('Bresenham wires match an integer reference in every octant, including clipping and highlighted widths', () => {
	const canvas = document.createElement('canvas');
	canvas.width = 32;
	canvas.height = 32;
	const engine = new Engine(canvas);
	const lines = new LineDrawer(engine);
	const endpoints: Point[] = [
		[28, 16],
		[28, 20],
		[28, 22],
		[28, 27],
		[28, 28],
		[27, 28],
		[22, 28],
		[20, 28],
		[16, 28],
		[12, 28],
		[4, 28],
		[4, 20],
		[4, 16],
		[4, 12],
		[4, 4],
		[12, 4],
		[16, 4],
		[20, 4],
		[28, 4],
		[28, 12],
		[16, 16],
	];
	const cases: Array<readonly [Point, Point]> = endpoints.map(end => [[16, 16], end]);
	cases.push(
		[
			[-12, -4],
			[45, 31],
		],
		[
			[12.4, 8.6],
			[26.6, 21.4],
		],
		[
			[-40_000, -20_000],
			[40_000, 20_000],
		]
	);
	try {
		for (const [start, end] of cases) {
			for (const thickness of [1, 2, 3]) {
				const expected = rasterizeReference(start, end, thickness, canvas.width, canvas.height);
				for (const [from, to] of [
					[start, end],
					[end, start],
				]) {
					engine.renderFrame(() => lines.drawLine(...from, ...to, thickness, [1, 1, 1, 1]));
					const actual = new Uint8Array(canvas.width * canvas.height * 4);
					engine.gl.readPixels(0, 0, canvas.width, canvas.height, engine.gl.RGBA, engine.gl.UNSIGNED_BYTE, actual);
					expect(occupiedPixels(actual, canvas.width), `${from} to ${to}, width ${thickness}`).toEqual(
						occupiedPixels(expected, canvas.width)
					);
				}
			}
		}
		expect(engine.gl.getError()).toBe(engine.gl.NO_ERROR);
	} finally {
		lines.destroy();
		engine.destroy();
	}
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
