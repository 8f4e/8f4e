import type { SpriteId } from 'glugglugglug';
import { describe, expect, it } from 'vitest';
import resolveCodeCells from './resolveCodeCells';
import { createSpriteCell } from './spriteCell';

const cell = (id: number, color: number) => createSpriteCell(id as SpriteId, color);

describe('resolveCodeCells', () => {
	it('applies color transitions at spaces and accepts palette index zero', () => {
		expect(resolveCodeCells([[65, 32, 66, 67]], [[undefined, 0]], 5, undefined)).toEqual([
			[cell(65, 5), null, cell(66, 0), cell(67, 0)],
		]);
	});
	it('uses shared fallback geometry with the active color for unknown glyphs', () => {
		expect(resolveCodeCells([[128]], [[2]], 5, undefined)).toEqual([[cell(63, 2)]]);
	});
	it('uses disabled color zero for all non-space cells', () => {
		expect(resolveCodeCells([[65, 32, 65]], [[2]], 5, 0)).toEqual([[cell(65, 0), null, cell(65, 0)]]);
	});
	it('resets each row to its default color', () => {
		expect(resolveCodeCells([[65], [65]], [[2], []], 5, undefined)).toEqual([[cell(65, 2)], [cell(65, 5)]]);
	});
});
