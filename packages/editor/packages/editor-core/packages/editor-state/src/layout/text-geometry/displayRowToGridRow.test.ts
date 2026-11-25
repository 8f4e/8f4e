import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import displayRowToGridRow from './displayRowToGridRow';

describe('displayRowToGridRow', () => {
	it('returns the same row when there are no preceding gaps', () => {
		const gaps: EditorCodeBlock['gaps'] = new Map([[5, { size: 2 }]]);
		expect(displayRowToGridRow(3, gaps)).toBe(3);
	});

	it('adds the size of each gap that starts before the row', () => {
		const gaps: EditorCodeBlock['gaps'] = new Map([
			[1, { size: 2 }],
			[4, { size: 1 }],
		]);
		expect(displayRowToGridRow(5, gaps)).toBe(8);
	});
});
