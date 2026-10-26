import type { SpriteId, SpriteIdLookups } from '@8f4e/sprite-generator';
import { createSpriteCell } from '@8f4e/sprite-generator';
import { describe, expect, it, vi } from 'vitest';
import { DrawContext } from './drawContext';

const ids = {
	font: { 63: 9 as SpriteId, 65: 1 as SpriteId, 66: 2 as SpriteId },
	fill: { 0: 7 as SpriteId },
	background: { 0: 8 as SpriteId },
} satisfies SpriteIdLookups;
describe('DrawContext', () => {
	it('forwards separate shared shape and color indices through nested offsets', () => {
		const target = { drawSprite: vi.fn() };
		const draw = new DrawContext(target, 8, ids);
		draw.startGroup(10, 20);
		draw.drawFill(1, 2, 0, 30, 40);
		draw.drawText(3, 4, 'AB', 5);
		draw.endGroup();
		expect(target.drawSprite.mock.calls).toEqual([
			[11, 22, 7, 0, 30, 40],
			[13, 24, 1, 5, undefined, undefined],
			[21, 24, 2, 5, undefined, undefined],
		]);
	});
	it('skips spaces, uses fallback glyphs, and updates font metrics', () => {
		const target = { drawSprite: vi.fn() };
		const draw = new DrawContext(target, 8, ids);
		draw.setCharacterWidth(6);
		draw.drawText(0, 0, 'A éΩ', 0);
		expect(target.drawSprite.mock.calls).toEqual([
			[0, 0, 1, 0, undefined, undefined],
			[12, 0, 9, 0, undefined, undefined],
			[18, 0, 9, 0, undefined, undefined],
		]);
	});
	it('uses pre-resolved shape/color cells and refreshes shared fill IDs after atlas replacement', () => {
		const target = { drawSprite: vi.fn() };
		const draw = new DrawContext(target, 8, ids);
		draw.drawResolvedText(2, 3, [createSpriteCell(0 as SpriteId, 0), null, createSpriteCell(2 as SpriteId, 4)]);
		draw.setSpriteLookups({ ...ids, fill: { 0: 12 as SpriteId } });
		draw.drawFill(0, 0, 5, 10, 20);
		expect(target.drawSprite.mock.calls).toEqual([
			[2, 3, 0, 0, undefined, undefined],
			[18, 3, 2, 4, undefined, undefined],
			[0, 0, 12, 5, 10, 20],
		]);
	});
});
