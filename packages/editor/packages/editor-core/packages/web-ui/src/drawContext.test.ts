import { textToGlyphIds } from '@8f4e/sprite-generator';
import type { SpriteId } from 'glugglugglug';
import { describe, expect, it, vi } from 'vitest';
import { DrawContext } from './drawContext';
import { createSpriteCell } from './spriteCell';

describe('DrawContext', () => {
	it('forwards separate shared shape and color indices through nested offsets', () => {
		const target = { drawSprite: vi.fn() };
		const draw = new DrawContext(target, 8);
		draw.startGroup(10, 20);
		draw.drawFill(1, 2, 0, 30, 40);
		draw.drawGlyphs(3, 4, textToGlyphIds('AB'), 5);
		draw.endGroup();
		expect(target.drawSprite.mock.calls).toEqual([
			[11, 22, 256, 0, 30, 40],
			[13, 24, 65, 5, undefined, undefined],
			[21, 24, 66, 5, undefined, undefined],
		]);
	});
	it('skips spaces, resolves Unicode to CP437, and updates font metrics', () => {
		const target = { drawSprite: vi.fn() };
		const draw = new DrawContext(target, 8);
		draw.setCharacterWidth(6);
		draw.drawGlyphs(0, 0, textToGlyphIds('A éΩ'), 0);
		expect(target.drawSprite.mock.calls).toEqual([
			[0, 0, 65, 0, undefined, undefined],
			[12, 0, 130, 0, undefined, undefined],
			[18, 0, 234, 0, undefined, undefined],
		]);
	});
	it('draws trusted numeric readouts directly from ASCII IDs', () => {
		const target = { drawSprite: vi.fn() };
		const draw = new DrawContext(target, 6);
		draw.drawNumericText(2, 3, '-1.5 0xAF', 4);
		expect(target.drawSprite.mock.calls.map(call => call.slice(0, 4))).toEqual([
			[2, 3, 45, 4],
			[8, 3, 49, 4],
			[14, 3, 46, 4],
			[20, 3, 53, 4],
			[32, 3, 48, 4],
			[38, 3, 120, 4],
			[44, 3, 65, 4],
			[50, 3, 70, 4],
		]);
	});
	it('uses packed shape/color cells and the fixed fill ID', () => {
		const target = { drawSprite: vi.fn() };
		const draw = new DrawContext(target, 8);
		draw.drawResolvedText(2, 3, [createSpriteCell(0 as SpriteId, 0), null, createSpriteCell(2 as SpriteId, 4)]);

		draw.drawFill(0, 0, 5, 10, 20);
		expect(target.drawSprite.mock.calls).toEqual([
			[2, 3, 0, 0, undefined, undefined],
			[18, 3, 2, 4, undefined, undefined],
			[0, 0, 256, 5, 10, 20],
		]);
	});
});
