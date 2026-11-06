import { describe, expect, it } from 'vitest';
import { CP437_CHARACTERS } from '../src/characterSet';
import { writeGlyph } from '../src/font';
import loadFontAtlas, { FILL_SPRITE_ID, FONT_NAMES, getGlyphSpriteId, textToGlyphIds } from '../src/index';

describe('R8 font atlases', () => {
	it('prepares Unicode text and spaces as shared glyph IDs', () => {
		expect(textToGlyphIds('0 -1.5 é☺')).toEqual([48, 32, 45, 49, 46, 53, 32, 130, 1]);
	});
	it('writes asymmetric bits at the correct row and column with an odd destination stride', () => {
		const data = new Uint8Array(7 * 5);
		writeGlyph(data, 7, new Uint8Array([0b101, 0b010]), 0, 3, 2, 2, 1);
		expect([...data.entries()].filter(([, value]) => value).map(([index]) => index)).toEqual([9, 11, 17]);
	});
	it.each(FONT_NAMES)('matches all source glyph pixels and the solid fill for %s', async font => {
		const { image, grid } = await loadFontAtlas(font);
		const { default: glyphs } = await import(`../src/fonts/${font}/ascii.ts`);
		const { cellWidth, cellHeight, columns, cellCount } = grid;
		expect([columns, cellCount]).toEqual([16, 257]);
		expect([image.width, image.height]).toEqual([cellWidth * 16, cellHeight * 17]);
		const expected = new Uint8Array(image.width * image.height);
		for (let code = 0; code < 256; code++) {
			for (let row = 0; row < cellHeight; row++) {
				for (let column = 0; column < cellWidth; column++) {
					const x = (code % 16) * cellWidth + column;
					const y = Math.floor(code / 16) * cellHeight + row;
					expected[y * image.width + x] = glyphs[code][row][column] === '#' ? 255 : 0;
				}
			}
		}
		for (let row = cellHeight * 16; row < image.height; row++)
			expected.fill(255, row * image.width, row * image.width + cellWidth);
		expect(image.data).toEqual(expected);
	});
	it('shares one lazy load across concurrent requests and later reuse', async () => {
		const first = loadFontAtlas('terminus12x24bold');
		expect(loadFontAtlas('terminus12x24bold')).toBe(first);
		const atlas = await first;
		expect(await loadFontAtlas('terminus12x24bold')).toBe(atlas);
	});
	it('maps every Unicode CP437 display character without colliding with fill', () => {
		expect(CP437_CHARACTERS).toHaveLength(256);
		expect(new Set(CP437_CHARACTERS).size).toBe(256);
		for (const [id, character] of [...CP437_CHARACTERS].entries())
			expect(getGlyphSpriteId(character.charCodeAt(0))).toBe(id);
		for (let code = 32; code < 127; code++) expect(getGlyphSpriteId(code)).toBe(code);
		expect(FILL_SPRITE_ID).toBe(256);
	});
	it.each([
		['é', 130],
		['Ω', 234],
		['┌', 218],
		['☺', 1],
		['→', 26],
		['⌂', 127],
		['\u00a0', 255],
	])('maps %s to its CP437 slot %i', (character, id) => {
		expect(getGlyphSpriteId(character.charCodeAt(0))).toBe(id);
	});
	it('uses the question-mark glyph for characters outside CP437', () => {
		for (const code of [128, 256, 0x6f22, 0xffff]) expect(getGlyphSpriteId(code)).toBe(63);
	});
	it('keeps unavailable font characters blank', async () => {
		const { default: glyphs } = await import('../src/fonts/spleen5x8/ascii');
		expect(glyphs[130]).toEqual(Array(8).fill('     '));
	});
});
