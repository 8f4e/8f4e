import { describe, expect, it } from 'vitest';
import insertNewLine from './insertNewLine';

describe('insertNewLine', () => {
	it('splits the current line at the caret', () => {
		const { code } = insertNewLine(['abcd'], 0, 2);
		expect(code).toEqual(['ab', 'cd']);
	});

	it('moves the caret to the start of the next line', () => {
		const { row, col } = insertNewLine(['ab'], 0, 2);
		expect(row).toBe(1);
		expect(col).toBe(0);
	});
});
