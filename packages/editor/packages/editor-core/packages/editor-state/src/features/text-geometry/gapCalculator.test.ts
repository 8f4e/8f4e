import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import gapCalculator from './gapCalculator';

describe('gapCalculator', () => {
	it('returns the same row when there are no preceding gaps', () => {
		const gaps: CodeBlockGraphicData['gaps'] = new Map([[5, { size: 2 }]]);
		expect(gapCalculator(3, gaps)).toBe(3);
	});

	it('adds the size of each gap that starts before the row', () => {
		const gaps: CodeBlockGraphicData['gaps'] = new Map([
			[1, { size: 2 }],
			[4, { size: 1 }],
		]);
		expect(gapCalculator(5, gaps)).toBe(8);
	});
});
