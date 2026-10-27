import { describe, expect, it } from 'vitest';
import { expandLineColorsToCells, expandLineToCells, getTabStopsByLine } from './tabExpansion';

describe('tabExpansion', () => {
	it('carries tab directives forward until the next valid directive', () => {
		expect(getTabStopsByLine(['; @tab 4 8', 'a\tb', '; @tab 2', 'x\ty'])).toEqual([[4, 8], [4, 8], [2], [2]]);
	});

	it('expands characters and syntax colors to the same visual columns', () => {
		expect(expandLineToCells('a\tb', [4])).toEqual([97, 9, 32, 32, 98]);
		expect(expandLineColorsToCells('a\tb', ['code', 'tab', 'code'], [4])).toEqual([
			'code',
			'tab',
			undefined,
			undefined,
			'code',
		]);
	});
});
