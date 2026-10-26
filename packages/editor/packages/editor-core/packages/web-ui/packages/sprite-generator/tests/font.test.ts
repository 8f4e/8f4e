import { describe, expect, it } from 'vitest';
import { createAtlasLayout } from '../src/atlasLayout';
import { writeGlyph } from '../src/font';
import generateSprite, { createSpriteCell, FONT_NAMES, type SpriteId } from '../src/index';

describe('R8 glyph masks', () => {
	it('writes asymmetric bits at the correct row and column with an odd destination stride', () => {
		const data = new Uint8Array(7 * 5);
		writeGlyph(data, 7, [0b101, 0b010], 0, 3, 2, 2, 1);
		expect([...data.entries()].filter(([, value]) => value).map(([index]) => index)).toEqual([9, 11, 17]);
		expect(new Set(data)).toEqual(new Set([0, 255]));
	});
	it.each(FONT_NAMES)('generates shared, bounded glyph and background masks for %s without canvas APIs', async font => {
		const { spriteAtlas, characterWidth, characterHeight } = await generateSprite({ font });
		const image = spriteAtlas.image;
		expect(image.data.length).toBe(image.width * image.height);
		expect(image.data.some(value => value === 255)).toBe(true);
		expect(Object.keys(spriteAtlas.spriteIdentifiers)).toEqual(['font', 'fill', 'background']);
		expect(Object.keys(spriteAtlas.lookup)).toHaveLength(130);
		for (const rect of Object.values(spriteAtlas.lookup)) {
			expect(rect.x + rect.spriteWidth).toBeLessThanOrEqual(image.width);
			expect(rect.y + rect.spriteHeight).toBeLessThanOrEqual(image.height);
		}
		const layout = createAtlasLayout(characterWidth, characterHeight);
		// The odd columns are empty, allowing the same mask to be shifted by one cell at runtime.
		for (let y = layout.background.y; y < image.height; y++) {
			for (let x = characterWidth; x < characterWidth * 2; x++) expect(image.data[y * image.width + x]).toBe(0);
		}
	});
	it('keeps mask pixels and all source rectangles unchanged when only the theme changes', async () => {
		const before = await generateSprite({ font: 'ibmvga8x16', palette: { primary: '#ffffff' } });
		const after = await generateSprite({ font: 'ibmvga8x16', palette: { primary: 'rgba(255,0,0,0.5)' } });
		expect(after.spriteAtlas).toEqual(before.spriteAtlas);
		expect(after.palette).not.toEqual(before.palette);
	});
});

it('keeps packed text cells unsigned and preserves zero-valued shapes and colors', () => {
	expect(createSpriteCell(0 as SpriteId, 0)).toBe(0);
	expect(createSpriteCell(0xffff as SpriteId, 0xffff)).toBe(0xffffffff);
	expect(createSpriteCell(42 as SpriteId, 7) & 0xffff).toBe(42);
	expect(createSpriteCell(42 as SpriteId, 7) >>> 16).toBe(7);
});
