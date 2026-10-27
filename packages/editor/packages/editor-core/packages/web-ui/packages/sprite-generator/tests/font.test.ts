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
	it.each(FONT_NAMES)('generates a uniform grid of glyph and fill masks for %s without canvas APIs', async font => {
		const { spriteAtlas, characterWidth, characterHeight } = await generateSprite({ font });
		const image = spriteAtlas.image;
		expect(image.data.length).toBe(image.width * image.height);
		expect(image.data.some(value => value === 255)).toBe(true);
		expect(Object.keys(spriteAtlas.sprites)).toEqual(['font', 'fill']);
		expect(spriteAtlas.grid).toEqual({
			cellWidth: characterWidth,
			cellHeight: characterHeight,
			columns: 16,
			cellCount: 129,
		});
		expect(Object.values(spriteAtlas.sprites.font)).toEqual(Array.from({ length: 128 }, (_, i) => i));
		expect(spriteAtlas.sprites.fill).toBe(128);
		expect(new Set(image.data)).toEqual(new Set([0, 255]));
		const layout = createAtlasLayout(characterWidth, characterHeight);
		expect([image.width, image.height]).toEqual([characterWidth * 16, characterHeight * 9]);
		for (let y = layout.fill.y; y < image.height; y++) {
			for (let x = 0; x < image.width; x++) {
				expect(image.data[y * image.width + x]).toBe(x < characterWidth ? 255 : 0);
			}
		}
	});
});

it('keeps packed text cells unsigned and preserves zero-valued shapes and colors', () => {
	expect(createSpriteCell(0 as SpriteId, 0)).toBe(0);
	expect(createSpriteCell(0xffff as SpriteId, 0xffff)).toBe(0xffffffff);
	expect(createSpriteCell(42 as SpriteId, 7) & 0xffff).toBe(42);
	expect(createSpriteCell(42 as SpriteId, 7) >>> 16).toBe(7);
});
