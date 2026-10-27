import { PALETTE_INDICES, type PaletteConfig, resolvePalette, toPaletteBytes } from '@8f4e/editor-palette';
import generateSprite, { FONT_NAMES, type SpriteData } from '@8f4e/sprite-generator';
import { Engine, type SpriteId, type SpriteLookup } from 'glugglugglug';
import { expect, test } from 'vitest';
import BackgroundRenderer from '../src/plugins/background';

/** Reconstruct the previous atlas layout independently of the procedural shaders. */
function legacyAtlas({ characterWidth: w, characterHeight: h, backgroundDot, spriteAtlas }: SpriteData) {
	const width = w * 32;
	const height = h * 24;
	const data = new Uint8Array(width * height);
	for (let y = 0; y < h * 8; y++) {
		data.set(
			spriteAtlas.image.data.subarray(y * spriteAtlas.image.width, (y + 1) * spriteAtlas.image.width),
			y * width
		);
	}
	data[w * 16] = 255;
	for (let y = 0; y < h * 16; y++) {
		for (let x = 0; x < width; x++) {
			if (
				x % (w * 2) >= backgroundDot.x &&
				x % (w * 2) < backgroundDot.x + backgroundDot.size &&
				y % h >= backgroundDot.y &&
				y % h < backgroundDot.y + backgroundDot.size
			)
				data[(y + h * 8) * width + x] = 255;
		}
	}
	const lookup: SpriteLookup = {
		...spriteAtlas.lookup,
		128: { x: w * 16, y: 0, spriteWidth: 1, spriteHeight: 1 },
		129: { x: 0, y: h * 8, spriteWidth: w * 32, spriteHeight: h * 16 },
	};
	return { image: { width, height, data }, lookup };
}

function createComparison() {
	const reference = new Engine(document.createElement('canvas'));
	const actual = new Engine(document.createElement('canvas'));
	let clear = [0, 0, 0, 0];
	for (const engine of [reference, actual]) {
		engine.hooks.preDraw.push(gl => {
			gl.clearColor(clear[0], clear[1], clear[2], clear[3]);
			gl.clear(gl.COLOR_BUFFER_BIT);
			// Simulate an underlay leaving drawing state dirty for the next pass.
			gl.viewport(0, 0, 1, 1);
			gl.colorMask(false, false, false, false);
			for (const state of [gl.SCISSOR_TEST, gl.DEPTH_TEST, gl.STENCIL_TEST, gl.CULL_FACE, gl.RASTERIZER_DISCARD])
				gl.enable(state);
			gl.blendFunc(gl.ZERO, gl.ZERO);
		});
	}
	const background = new BackgroundRenderer(actual);
	let fill = 0 as SpriteId;
	let dots = fill;
	let fontWidth = 8;
	let fontHeight = 16;
	return {
		install(data: SpriteData, config: PaletteConfig = {}) {
			const old = legacyAtlas(data);
			const resolved = reference.setSpriteAtlas(old.image, old.lookup);
			fill = resolved.resolveSprite(128);
			dots = resolved.resolveSprite(129);
			actual.setSpriteAtlas(data.spriteAtlas.image, data.spriteAtlas.lookup);
			const bytes = toPaletteBytes(resolvePalette(config));
			reference.setPalette(bytes);
			actual.setPalette(bytes);
			background.setPalette(bytes);
			background.setFont(data);
			fontWidth = data.characterWidth;
			fontHeight = data.characterHeight;
		},
		compare(width: number, height: number) {
			for (const engine of [reference, actual]) engine.resize(width, height);
			for (const underlay of [
				[0, 0, 0, 0],
				[0.125, 0.25, 0.375, 1],
			]) {
				clear = underlay;
				reference.renderFrame(() => {
					reference.drawSprite(0, 0, fill, PALETTE_INDICES.canvasBase, width, height);
					for (let x = 0; x < width; x += fontWidth * 32) {
						for (let y = 0; y < height; y += fontHeight * 16) {
							reference.drawSprite(x, y, dots, PALETTE_INDICES.canvasDetail2);
							reference.drawSprite(x + fontWidth, y, dots, PALETTE_INDICES.canvasDetail1);
						}
					}
				});
				actual.renderFrame(() => {});
				const pixels = [reference, actual].map(engine => {
					const value = new Uint8Array(width * height * 4);
					engine.gl.readPixels(0, 0, width, height, engine.gl.RGBA, engine.gl.UNSIGNED_BYTE, value);
					expect(engine.gl.getError()).toBe(engine.gl.NO_ERROR);
					return value;
				});
				let maxDelta = 0;
				let differentChannels = 0;
				for (let i = 0; i < pixels[0].length; i++) {
					const delta = Math.abs(pixels[0][i] - pixels[1][i]);
					maxDelta = Math.max(maxDelta, delta);
					if (delta) differentChannels++;
				}
				expect({ maxDelta, differentChannels }).toEqual({ maxDelta: 0, differentChannels: 0 });
				expect(actual.frameStats.spriteCount).toBe(0);
			}
		},
		releaseAndRestore() {
			for (const engine of [reference, actual]) {
				engine.releaseRenderingMemory();
				engine.restoreRenderingMemory();
			}
		},
		destroy() {
			background.destroy();
			for (const engine of [reference, actual]) {
				engine.destroy();
				engine.gl.getExtension('WEBGL_lose_context')?.loseContext();
			}
		},
	};
}

test.each(FONT_NAMES)('procedural background matches the former tile mask for %s', async font => {
	const comparison = createComparison();
	try {
		comparison.install(await generateSprite({ font }));
		comparison.compare(129, 97);
	} finally {
		comparison.destroy();
	}
});

test.each([
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
])('procedural background preserves $name compositing and partial tiles', async ({ config, width, height }) => {
	const comparison = createComparison();
	try {
		comparison.install(await generateSprite(), config);
		comparison.compare(width, height);
	} finally {
		comparison.destroy();
	}
});

test('background updates after font, palette, viewport, and rendering-memory changes', async () => {
	const comparison = createComparison();
	try {
		comparison.install(await generateSprite());
		comparison.compare(129, 97);
		comparison.install(await generateSprite({ font: 'spleen5x8' }), { canvas: '#182030' });
		comparison.compare(321, 197);
		comparison.releaseAndRestore();
		comparison.compare(211, 143);
	} finally {
		comparison.destroy();
	}
});
