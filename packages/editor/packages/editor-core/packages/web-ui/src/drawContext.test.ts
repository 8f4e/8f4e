import type { SpriteId } from '@8f4e/sprite-generator';
import { createSpriteCell } from '@8f4e/web-ui-render-projection';
import { describe, expect, it, vi } from 'vitest';
import { DrawContext } from './drawContext';

describe('DrawContext', () => {
	it('forwards separate shared shape and color indices through nested offsets', () => {
		const target = { drawSprite: vi.fn() };
		const draw = new DrawContext(target, 8);
		draw.startGroup(10, 20);
		draw.drawFill(1, 2, 0, 30, 40);
		draw.drawText(3, 4, 'AB', 5);
		draw.endGroup();
		expect(target.drawSprite.mock.calls).toEqual([
			[11, 22, 128, 0, 30, 40],
			[13, 24, 65, 5, undefined, undefined],
			[21, 24, 66, 5, undefined, undefined],
		]);
	});
	it('skips spaces, uses fallback glyphs, and updates font metrics', () => {
		const target = { drawSprite: vi.fn() };
		const draw = new DrawContext(target, 8);
		draw.setCharacterWidth(6);
		draw.drawText(0, 0, 'A éΩ', 0);
		expect(target.drawSprite.mock.calls).toEqual([
			[0, 0, 65, 0, undefined, undefined],
			[12, 0, 63, 0, undefined, undefined],
			[18, 0, 63, 0, undefined, undefined],
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
			[0, 0, 128, 5, 10, 20],
		]);
	});
});
