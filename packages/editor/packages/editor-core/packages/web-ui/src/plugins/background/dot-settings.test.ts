import { FONT_NAMES } from '@8f4e/sprite-generator';
import { describe, expect, it } from 'vitest';
import { BACKGROUND_DOTS } from './dot-settings';

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

describe('procedural background metrics', () => {
	it('covers every bundled font', () => {
		expect(backgrounds.map(([font]) => font).sort()).toEqual([...FONT_NAMES].sort());
	});

	it.each(backgrounds)(
		'preserves the dot placement for %s without allocating background atlas pixels',
		(font, width, height, dotX, dotY, size) => {
			expect(BACKGROUND_DOTS[font]).toEqual({ x: dotX, y: dotY, size });
			expect(dotX + size).toBeLessThanOrEqual(width);
			expect(dotY + size).toBeLessThanOrEqual(height);
		}
	);
});
