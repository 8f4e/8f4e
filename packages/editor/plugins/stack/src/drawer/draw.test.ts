import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { textToGlyphIds } from '@8f4e/web-ui';
import { describe, expect, it, vi } from 'vitest';
import { createDrawContextMock } from '../__tests__/rendering';
import drawStack from './draw';

describe('stack label drawing', () => {
	it.each([
		{ now: 0, reduced: false },
		{ now: 1100, reduced: true },
	])('keeps brackets at rest for $now ms and reduced=$reduced', ({ now, reduced }) => {
		const draw = createDrawContextMock();
		drawStack(draw, 8, 16, [{ x: 5, y: 7, glyphs: textToGlyphIds('2, 3') }], now, reduced);
		expect(draw.drawSprite).toHaveBeenNthCalledWith(1, 5, 7, 91, PALETTE_INDICES.inkBase, 8, 16);
		expect(draw.drawGlyphs).toHaveBeenCalledWith(13, 7, textToGlyphIds('2, 3'), PALETTE_INDICES.secondaryBase);
		expect(draw.drawSprite).toHaveBeenNthCalledWith(2, 45, 7, 93, PALETTE_INDICES.inkBase, 8, 16);
	});
	it('moves and scales brackets around stationary text', () => {
		const draw = createDrawContextMock();
		drawStack(draw, 8, 16, [{ x: 5, y: 7, glyphs: textToGlyphIds('2, 3') }], 275, false);
		const [x, y, sprite, , width, height] = vi.mocked(draw.drawSprite).mock.calls[0];
		expect(x).toBeCloseTo(4.17);
		expect(y).toBeCloseTo(6.84);
		expect(sprite).toBe(91);
		expect(width).toBeCloseTo(8.16);
		expect(height).toBeCloseTo(16.32);
		expect(draw.drawGlyphs).toHaveBeenCalledWith(13, 7, textToGlyphIds('2, 3'), PALETTE_INDICES.secondaryBase);
	});
});
