import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import reverseGapCalculator from './reverseGapCalculator';

describe('reverseGapCalculator', () => {
	it('returns the physical row when no gap applies', () => {
		const gaps: CodeBlockGraphicData['gaps'] = new Map([[5, { size: 3 }]]);
		expect(reverseGapCalculator(2, gaps)).toBe(2);
	});

	it('subtracts gap sizes that affect the row', () => {
		const gaps: CodeBlockGraphicData['gaps'] = new Map([
			[1, { size: 2 }],
			[4, { size: 3 }],
		]);
		expect(reverseGapCalculator(10, gaps)).toBe(5);
	});

	it('never returns a negative row', () => {
		const gaps: CodeBlockGraphicData['gaps'] = new Map([[0, { size: 10 }]]);
		expect(reverseGapCalculator(5, gaps)).toBe(0);
	});
});
