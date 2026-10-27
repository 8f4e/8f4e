import { describe, expect, it } from 'vitest';
import { writeGlyph } from '../src/font';
import loadFontAtlas, { FILL_SPRITE_ID, FONT_NAMES, getGlyphSpriteId } from '../src/index';

describe('R8 font atlases', () => {
	it('writes asymmetric bits at the correct row and column with an odd destination stride', () => {
		const data = new Uint8Array(7 * 5);
		writeGlyph(data, 7, new Uint8Array([0b101, 0b010]), 0, 3, 2, 2, 1);
		expect([...data.entries()].filter(([, value]) => value).map(([index]) => index)).toEqual([9, 11, 17]);
	});
	it.each(FONT_NAMES)('matches all source glyph pixels and the solid fill for %s', async font => {
		const { image, grid } = await loadFontAtlas(font);
		const { default: glyphs } = await import(`../src/fonts/${font}/ascii.ts`);
		const { cellWidth, cellHeight, columns, cellCount } = grid;
		expect([columns, cellCount]).toEqual([16, 129]);
		expect([image.width, image.height]).toEqual([cellWidth * 16, cellHeight * 9]);
		const expected = new Uint8Array(image.width * image.height);
		for (let code = 0; code < 128; code++) {
			for (let row = 0; row < cellHeight; row++) {
				for (let column = 0; column < cellWidth; column++) {
					const x = (code % 16) * cellWidth + column;
					const y = Math.floor(code / 16) * cellHeight + row;
					expected[y * image.width + x] = glyphs[code][row][column] === '#' ? 255 : 0;
				}
			}
		}
		for (let row = cellHeight * 8; row < image.height; row++)
			expected.fill(255, row * image.width, row * image.width + cellWidth);
		expect(image.data).toEqual(expected);
	});
	it('shares one lazy load across concurrent requests and later reuse', async () => {
		const first = loadFontAtlas('terminus12x24bold');
		expect(loadFontAtlas('terminus12x24bold')).toBe(first);
		const atlas = await first;
		expect(await loadFontAtlas('terminus12x24bold')).toBe(atlas);
	});
	it('uses fixed ASCII IDs and the question-mark fallback without colliding with fill', () => {
		for (let code = 0; code < 128; code++) expect(getGlyphSpriteId(code)).toBe(code);
		for (const code of [-1, 128, 233, 937, 0xffff]) expect(getGlyphSpriteId(code)).toBe(63);
		expect(FILL_SPRITE_ID).toBe(128);
	});
});
