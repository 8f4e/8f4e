import type { SpriteFont, SpriteId } from '@8f4e/sprite-generator';
import { createSpriteCell } from '@8f4e/sprite-generator';
import { describe, expect, it } from 'vitest';
import resolveCodeCells from './resolveCodeCells';

const cell = (id: number, color: number) => createSpriteCell(id as SpriteId, color);

const font = { 63: 90 as SpriteId, 65: 1 as SpriteId, 66: 2 as SpriteId, 67: 3 as SpriteId } as SpriteFont;
describe('resolveCodeCells', () => {
	it('applies color transitions at spaces and accepts palette index zero', () => {
		expect(resolveCodeCells([[65, 32, 66, 67]], [[undefined, 0]], 5, undefined, font)).toEqual([
			[cell(1, 5), null, cell(2, 0), cell(3, 0)],
		]);
	});
	it('uses shared fallback geometry with the active color for unknown glyphs', () => {
		expect(resolveCodeCells([['unknown']], [[2]], 5, undefined, font)).toEqual([[cell(90, 2)]]);
	});
	it('uses disabled color zero for all non-space cells', () => {
		expect(resolveCodeCells([[65, 32, 65]], [[2]], 5, 0, font)).toEqual([[cell(1, 0), null, cell(1, 0)]]);
	});
	it('resets each row to its default color', () => {
		expect(resolveCodeCells([[65], [65]], [[2], []], 5, undefined, font)).toEqual([[cell(1, 2)], [cell(1, 5)]]);
	});
});
