import { PALETTE_INDICES, resolvePalette, toPaletteBytes } from '@8f4e/editor-palette';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import BackgroundRenderer from '../src/backgroundRenderer';

interface ExpectedGrid {
	vGrid: number;
	hGrid: number;
	dot: { x: number; y: number; size: number };
}

const defaultGrid: ExpectedGrid = { vGrid: 8, hGrid: 16, dot: { x: 3, y: 7, size: 2 } };
const smallGrid: ExpectedGrid = { vGrid: 5, hGrid: 8, dot: { x: 2, y: 3, size: 1 } };

function palette(base: number[], even: number[], odd: number[]): Uint8Array {
	const bytes = new Uint8Array(256 * 4);
	bytes.set(base, PALETTE_INDICES.canvasBase * 4);
	bytes.set(even, PALETTE_INDICES.canvasDetail2 * 4);
	bytes.set(odd, PALETTE_INDICES.canvasDetail1 * 4);
	return bytes;
}

/** Expected premultiplied source-over colors, rounded only when writing the final RGBA8 pixel. */
function expectedColors(bytes: Uint8Array, underlay: number[]) {
	const [base, ...dots] = (['canvasBase', 'canvasDetail2', 'canvasDetail1'] as const).map(token => {
		const offset = PALETTE_INDICES[token] * 4;
		const alpha = bytes[offset + 3] / 255;
		return [(bytes[offset] / 255) * alpha, (bytes[offset + 1] / 255) * alpha, (bytes[offset + 2] / 255) * alpha, alpha];
	});
	const sources = [base, ...dots.map(dot => dot.map((channel, index) => channel + base[index] * (1 - dot[3])))];
	return sources.map(source =>
		source.map((channel, index) => Math.round((channel + (underlay[index] / 255) * (1 - source[3])) * 255))
	);
}

function createScene() {
	const engine = new Engine(document.createElement('canvas'));
	let viewport = { x: 0, y: 0, vGrid: 8, hGrid: 16 };
	let underlay = [0, 0, 0, 0];
	engine.hooks.preDraw.push(gl => {
		gl.disable(gl.RASTERIZER_DISCARD);
		gl.clearColor(underlay[0] / 255, underlay[1] / 255, underlay[2] / 255, underlay[3] / 255);
		gl.clear(gl.COLOR_BUFFER_BIT);
		// Other raw-context hooks can leave state for the background pass to reset.
		gl.viewport(0, 0, 1, 1);
		gl.colorMask(false, false, false, false);
		for (const state of [gl.SCISSOR_TEST, gl.DEPTH_TEST, gl.STENCIL_TEST, gl.CULL_FACE, gl.RASTERIZER_DISCARD])
			gl.enable(state);
		gl.blendFunc(gl.ZERO, gl.ZERO);
	});
	const background = new BackgroundRenderer(engine.gl);
	engine.hooks.preDraw.push(() => background.draw(viewport));
	let bytes: Uint8Array;
	return {
		setPalette(colors = toPaletteBytes(resolvePalette())) {
			bytes = colors;
			engine.setPalette(bytes);
			background.setPalette(bytes);
		},
		check(width: number, height: number, grid = defaultGrid, origin = { x: 0, y: 0 }) {
			const { vGrid: cellWidth, hGrid: cellHeight, dot } = grid;
			viewport = { ...origin, vGrid: cellWidth, hGrid: cellHeight };
			engine.resize(width, height);
			const columns = Array.from({ length: width }, (_, x) => {
				const worldX = x + origin.x;
				const column = Math.floor(worldX / cellWidth);
				const local = worldX - column * cellWidth;
				return local >= dot.x && local < dot.x + dot.size ? (column % 2 === 0 ? 1 : 2) : 0;
			});
			for (const color of [
				[0, 0, 0, 0],
				[32, 64, 96, 255],
			]) {
				underlay = color;
				engine.renderFrame(() => {});
				const actual = new Uint8Array(width * height * 4);
				engine.gl.readPixels(0, 0, width, height, engine.gl.RGBA, engine.gl.UNSIGNED_BYTE, actual);
				const expected = expectedColors(bytes, color);
				let maxDelta = 0;
				for (let y = 0; y < height; y++) {
					const worldY = height - 1 - y + origin.y;
					const localY = worldY - Math.floor(worldY / cellHeight) * cellHeight;
					const dotRow = localY >= dot.y && localY < dot.y + dot.size;
					for (let x = 0; x < width; x++) {
						const pixel = expected[dotRow ? columns[x] : 0];
						const offset = (y * width + x) * 4;
						for (let channel = 0; channel < 4; channel++)
							maxDelta = Math.max(maxDelta, Math.abs(actual[offset + channel] - pixel[channel]));
					}
				}
				// Float shader/blend precision can differ from the ideal calculation by one RGBA8 step.
				expect(maxDelta).toBeLessThanOrEqual(1);
				expect(engine.gl.getError()).toBe(engine.gl.NO_ERROR);
				expect(engine.frameStats).toEqual({ spriteCount: 0, uploadedInstanceBytes: 0 });
			}
		},
		restore() {
			engine.releaseRenderingMemory();
			engine.restoreRenderingMemory();
		},
		destroy() {
			background.destroy();
			engine.destroy();
			engine.gl.getExtension('WEBGL_lose_context')?.loseContext();
		},
	};
}

// Explicit expected pixel bounds for representative cells, independent of the renderer's calculation.
test.each([
	[6, 10, 2, 4, 2],
	[8, 9, 3, 3, 2],
	[7, 10, 2, 4, 2],
	[7, 14, 2, 6, 2],
	[6, 12, 2, 5, 2],
	[8, 8, 3, 3, 2],
	[8, 16, 3, 7, 2],
	[5, 11, 2, 5, 1],
	[5, 8, 2, 3, 1],
	[10, 18, 3, 7, 3],
	[12, 13, 4, 5, 3],
	[12, 24, 4, 10, 3],
	[16, 32, 6, 14, 4],
	[1, 1, 0, 0, 1],
	[2, 7, 0, 3, 1],
	[21, 6, 9, 2, 2],
	[33, 61, 12, 26, 8],
])('draws centered alternating dots in a %i×%i pixel grid cell', (vGrid, hGrid, x, y, size) => {
	const scene = createScene();
	try {
		scene.setPalette(palette([17, 31, 47, 128], [211, 41, 3, 128], [7, 137, 239, 64]));
		scene.check(129, 97, { vGrid, hGrid, dot: { x, y, size } });
	} finally {
		scene.destroy();
	}
});

test('pans dots with the viewport origin without losing color parity or pixel precision', () => {
	const scene = createScene();
	try {
		scene.setPalette(palette([17, 31, 47, 255], [211, 41, 3, 255], [7, 137, 239, 255]));
		scene.check(33, 35, defaultGrid, { x: 3, y: 5 });
		scene.check(33, 35, defaultGrid, { x: defaultGrid.vGrid, y: 0 });
		scene.check(33, 35, defaultGrid, { x: -3, y: -5 });
		scene.check(33, 35, defaultGrid, { x: 2 ** 30 + 5, y: -(2 ** 30) - 7 });
		scene.check(33, 35);
	} finally {
		scene.destroy();
	}
});

test.each([
	{ name: 'default', config: {}, width: 257, height: 193 },
	{ name: 'opaque', config: { canvas: '#182030' }, width: 257, height: 193 },
	{
		name: 'translucent',
		config: { canvas: 'rgba(20,30,40,0.4)', surface: 'rgba(230,230,230,0.3)' },
		width: 257,
		height: 193,
	},
	{ name: '1080p', config: {}, width: 1920, height: 1080 },
	{
		name: '4K translucent',
		config: { canvas: 'rgba(20,30,40,0.4)', surface: 'rgba(230,230,230,0.3)' },
		width: 3840,
		height: 2160,
	},
])('composites the $name background over transparent and opaque content', ({ config, width, height }) => {
	const scene = createScene();
	try {
		scene.setPalette(toPaletteBytes(resolvePalette(config)));
		scene.check(width, height);
	} finally {
		scene.destroy();
	}
});

const transparencyCases: Array<[string, number[], number[], number[]]> = [
	['invisible', [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
	['base only', [10, 20, 30, 128], [0, 0, 0, 0], [0, 0, 0, 0]],
	['even dots only', [0, 0, 0, 0], [10, 20, 30, 128], [0, 0, 0, 0]],
	['odd dots only', [0, 0, 0, 0], [0, 0, 0, 0], [10, 20, 30, 128]],
];

test.each(transparencyCases)('handles a background with %s', (_name, base, even, odd) => {
	const scene = createScene();
	try {
		scene.setPalette(palette(base, even, odd));
		scene.check(33, 35);
	} finally {
		scene.destroy();
	}
});

test('updates grid, palette, and viewport independently and survives rendering-memory restoration', () => {
	const scene = createScene();
	try {
		scene.setPalette();
		scene.check(129, 97);
		scene.check(321, 197, smallGrid);
		scene.setPalette(toPaletteBytes(resolvePalette({ canvas: '#182030' })));
		scene.check(321, 197, smallGrid);
		scene.check(33, 35, smallGrid, { x: -3, y: 9 });
		scene.restore();
		scene.check(211, 143, smallGrid);
		scene.check(211, 143, { vGrid: 21, hGrid: 6, dot: { x: 9, y: 2, size: 2 } });
	} finally {
		scene.destroy();
	}
});
