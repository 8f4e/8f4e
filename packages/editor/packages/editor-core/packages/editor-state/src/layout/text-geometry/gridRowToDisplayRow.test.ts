import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import gridRowToDisplayRow from './gridRowToDisplayRow';

describe('gridRowToDisplayRow', () => {
	it('returns the physical row when no gap applies', () => {
		const gaps: EditorCodeBlock['gaps'] = new Map([[5, { size: 3 }]]);
		expect(gridRowToDisplayRow(2, gaps)).toBe(2);
	});

	it('subtracts gap sizes that affect the row', () => {
		const gaps: EditorCodeBlock['gaps'] = new Map([
			[1, { size: 2 }],
			[4, { size: 3 }],
		]);
		expect(gridRowToDisplayRow(10, gaps)).toBe(5);
	});

	it('never returns a negative row', () => {
		const gaps: EditorCodeBlock['gaps'] = new Map([[0, { size: 10 }]]);
		expect(gridRowToDisplayRow(5, gaps)).toBe(0);
	});
});
