import { describe, expect, it } from 'vitest';
import generateSprite, { BACKGROUND_COLUMNS, BACKGROUND_ROWS, FONT_NAMES } from '../src/index.ts';

// Pixel bounds captured from the former DOT bitmaps, including their off-center placement.
const backgrounds = [
	['attpc63008x16', 8, 16, 3, 7, 2],
	['6x10', 6, 10, 1, 4, 2],
	['nix8810m168x16', 8, 16, 3, 7, 2],
	['olivettithin8x16', 8, 16, 3, 7, 2],
	['spleen5x8', 5, 8, 1, 4, 2],
	['spleen6x12', 6, 12, 1, 5, 2],
	['ibmvga8x16', 8, 16, 3, 7, 2],
	['spleen8x16', 8, 16, 3, 7, 2],
	['templeos8x8', 8, 8, 2, 4, 2],
	['terminus8x16', 8, 16, 3, 7, 2],
	['terminus8x16bold', 8, 16, 3, 7, 2],
	['terminus10x18', 10, 18, 4, 8, 2],
	['terminus10x18bold', 10, 18, 4, 8, 2],
	['kana12x13', 12, 13, 4, 5, 2],
	['spleen12x24', 12, 24, 5, 11, 2],
	['terminus12x24', 12, 24, 5, 11, 2],
	['terminus12x24bold', 12, 24, 5, 11, 2],
	['spleen16x32', 16, 32, 6, 14, 4],
] as const;

describe('background mask', () => {
	it('covers every bundled font', () => {
		expect(backgrounds.map(([font]) => font).sort()).toEqual([...FONT_NAMES].sort());
	});

	it.each(backgrounds)(
		'preserves the background pixels and atlas sources for %s',
		async (font, width, height, dotX, dotY, size) => {
			const { characterWidth, characterHeight, spriteAtlas } = await generateSprite({ font });
			expect([characterWidth, characterHeight]).toEqual([width, height]);
			const background = spriteAtlas.lookup[spriteAtlas.spriteIdentifiers.background];
			expect(background).toEqual({
				x: 0,
				y: height * 8,
				spriteWidth: width * BACKGROUND_COLUMNS,
				spriteHeight: height * BACKGROUND_ROWS,
			});
			const pixels = spriteAtlas.image.data.slice(background.y * spriteAtlas.image.width);
			const expected = Uint8Array.from({ length: background.spriteWidth * background.spriteHeight }, (_, index) => {
				const x = index % background.spriteWidth;
				const y = Math.floor(index / background.spriteWidth);
				const inDot =
					x % (width * 2) >= dotX && x % (width * 2) < dotX + size && y % height >= dotY && y % height < dotY + size;
				return inDot ? 255 : 0;
			});
			expect(pixels).toEqual(expected);
			expect(Object.keys(spriteAtlas.lookup)).toHaveLength(130);
			expect(Object.keys(spriteAtlas.spriteIdentifiers.font)).toHaveLength(128);
			const fill = spriteAtlas.lookup[spriteAtlas.spriteIdentifiers.fill];
			expect(fill).toEqual({ x: width * 16, y: 0, spriteWidth: 1, spriteHeight: 1 });
			expect(spriteAtlas.image.data[fill.y * spriteAtlas.image.width + fill.x]).toBe(255);
		}
	);
});
