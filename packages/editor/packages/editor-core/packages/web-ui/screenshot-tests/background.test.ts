import { PALETTE_INDICES, resolvePalette, toPaletteBytes } from '@8f4e/editor-palette';
import generateSprite, { FONT_NAMES, type SpriteData } from '@8f4e/sprite-generator';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import BackgroundRenderer from '../src/plugins/background';

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
	const background = new BackgroundRenderer(engine);
	let font: SpriteData;
	let bytes: Uint8Array;
	return {
		install(data: SpriteData, colors = toPaletteBytes(resolvePalette())) {
			font = data;
			bytes = colors;
			engine.setSpriteAtlas(data.spriteAtlas.image, data.spriteAtlas.grid);
			engine.setPalette(bytes);
			background.setFont(data);
			background.setPalette(bytes);
		},
		check(width: number, height: number) {
			engine.resize(width, height);
			const { characterWidth: cellWidth, characterHeight: cellHeight, backgroundDot: dot } = font;
			const columns = Array.from({ length: width }, (_, x) => {
				const local = x % cellWidth;
				return local >= dot.x && local < dot.x + dot.size ? 1 + (Math.floor(x / cellWidth) % 2) : 0;
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
					const localY = (height - 1 - y) % cellHeight;
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

test.each(FONT_NAMES)('draws correctly positioned alternating dots for %s', async font => {
	const scene = createScene();
	try {
		scene.install(await generateSprite({ font }), palette([17, 31, 47, 128], [211, 41, 3, 128], [7, 137, 239, 64]));
		scene.check(129, 97);
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
])('composites the $name background over transparent and opaque content', async ({ config, width, height }) => {
	const scene = createScene();
	try {
		scene.install(await generateSprite(), toPaletteBytes(resolvePalette(config)));
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

test.each(transparencyCases)('handles a background with %s', async (_name, base, even, odd) => {
	const scene = createScene();
	try {
		scene.install(await generateSprite(), palette(base, even, odd));
		scene.check(33, 35);
	} finally {
		scene.destroy();
	}
});

test('updates font, palette, and viewport and survives rendering-memory restoration', async () => {
	const scene = createScene();
	try {
		scene.install(await generateSprite());
		scene.check(129, 97);
		scene.install(await generateSprite({ font: 'spleen5x8' }), toPaletteBytes(resolvePalette({ canvas: '#182030' })));
		scene.check(321, 197);
		scene.restore();
		scene.check(211, 143);
	} finally {
		scene.destroy();
	}
});
