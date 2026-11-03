import { describe, expect, it } from 'vitest';
import {
	getRawIndexForVisualColumn,
	getTabStopsByLine,
	getVisualColumnForRawIndex,
	getVisualLineWidth,
} from './tabLayout';

describe('getTabStopsByLine', () => {
	it('parses multiple stops from a single directive', () => {
		expect(getTabStopsByLine(['; @tab 8 16 24', '\tfoo'])).toEqual([
			[8, 16, 24],
			[8, 16, 24],
		]);
	});

	it('uses the most recent valid directive from that line onward', () => {
		expect(getTabStopsByLine(['; @tab 4 8', '\tfoo', '; @tab 12 20', '\tbar'])).toEqual([
			[4, 8],
			[4, 8],
			[12, 20],
			[12, 20],
		]);
	});

	it('ignores malformed directives and keeps the previous active stops', () => {
		expect(getTabStopsByLine(['; @tab 4 8', '\tfoo', '; @tab nope', '\tbar'])).toEqual([
			[4, 8],
			[4, 8],
			[4, 8],
			[4, 8],
		]);
	});

	it('starts with fallback width 1 before any valid directive appears', () => {
		expect(getTabStopsByLine(['\tfoo', '; @tab 6 12', '\tbar'])).toEqual([[], [6, 12], [6, 12]]);
	});
});

describe('tab layout helpers', () => {
	it('maps raw indices to visual columns using declared tab stops', () => {
		expect(getVisualColumnForRawIndex('a\tb', 0, [4, 8])).toBe(0);
		expect(getVisualColumnForRawIndex('a\tb', 1, [4, 8])).toBe(1);
		expect(getVisualColumnForRawIndex('a\tb', 2, [4, 8])).toBe(4);
		expect(getVisualColumnForRawIndex('a\tb', 3, [4, 8])).toBe(5);
	});

	it('falls back to width 1 when no later tab stop exists', () => {
		expect(getVisualColumnForRawIndex('\t\t', 2, [4])).toBe(5);
		expect(getVisualLineWidth('\t\t', [4])).toBe(5);
	});

	it('maps visual columns inside a tab span to the raw index after the tab', () => {
		expect(getRawIndexForVisualColumn('a\tb', 0, [4, 8])).toBe(0);
		expect(getRawIndexForVisualColumn('a\tb', 1, [4, 8])).toBe(1);
		expect(getRawIndexForVisualColumn('a\tb', 2, [4, 8])).toBe(2);
		expect(getRawIndexForVisualColumn('a\tb', 3, [4, 8])).toBe(2);
		expect(getRawIndexForVisualColumn('a\tb', 4, [4, 8])).toBe(2);
		expect(getRawIndexForVisualColumn('a\tb', 5, [4, 8])).toBe(3);
	});
});
