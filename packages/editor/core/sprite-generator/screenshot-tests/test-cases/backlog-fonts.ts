import { PALETTE_INDICES, resolvePalette, toPaletteBytes } from '@8f4e/editor-palette';
import loadFontAtlas, { FILL_SPRITE_ID, type Font, textToGlyphIds } from '@8f4e/sprite-generator';
import { Engine } from 'glugglugglug';

const fonts: Array<[Font, string]> = [
	['pixelcode6x12', 'PixelCode · 6×12'],
	['eaglespcgaalt38x8', 'EagleSpCGA Alt3 · 8×8'],
	['sergamon8x16', 'Sergamon · 8×16'],
	['scientifica5x11', 'Scientifica · 5×11'],
];
const lines = [
	'module fonts',
	'; pixel fonts / CP437',
	'float frequency 440',
	'push &frequency',
	'push 0.5 ; [] {} () +-*/',
	'moduleEnd',
	'é Ç ß α Ω ┌─┬─┐ ░▒▓█',
].map(textToGlyphIds);

for (const [font, title] of fonts) {
	const section = document.createElement('section');
	const heading = document.createElement('h2');
	heading.textContent = title;
	section.append(heading);
	const canvas = document.createElement('canvas');
	const atlas = await loadFontAtlas(font);
	const width = atlas.grid.cellWidth * 2;
	const height = atlas.grid.cellHeight * 2;
	canvas.width = 460;
	canvas.height = height * lines.length + 16;
	canvas.setAttribute('aria-label', title);
	section.append(canvas);
	document.querySelector('main')!.append(section);
	const engine = new Engine(canvas);
	engine.setSpriteAtlas(atlas.image, atlas.grid);
	engine.setPalette(toPaletteBytes(resolvePalette()));
	engine.renderFrame(() => {
		engine.drawSprite(0, 0, FILL_SPRITE_ID, PALETTE_INDICES.surfaceBase, canvas.width, canvas.height);
		for (const [row, glyphs] of lines.entries()) {
			for (const [column, glyph] of glyphs.entries()) {
				if (glyph === 32) continue;
				engine.drawSprite(
					8 + column * width,
					8 + row * height,
					glyph,
					row === 1 ? PALETTE_INDICES.tertiaryBase : PALETTE_INDICES.inkBase,
					width,
					height
				);
			}
		}
	});
}
document.body.dataset.ready = 'true';
