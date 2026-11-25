import { describe, expect, it } from 'vitest';
import deleteBackward from './deleteBackward';

describe('deleteBackward', () => {
	it('removes a character when the caret is not at the start of the line', () => {
		const { code, row, col } = deleteBackward(['abc'], 0, 2);
		expect(code).toEqual(['ac']);
		expect(row).toBe(0);
		expect(col).toBe(1);
	});

	it('merges with the previous line when deleting at column 0', () => {
		const { code, row, col } = deleteBackward(['ab', 'cd'], 1, 0);
		expect(code).toEqual(['abcd']);
		expect(row).toBe(0);
		expect(col).toBe(2);
	});

	it('does nothing when already at the beginning of the document', () => {
		const code = ['ab'];
		expect(deleteBackward(code, 0, 0)).toEqual({ code, row: 0, col: 0 });
	});
});
