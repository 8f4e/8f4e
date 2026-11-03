import { describe, expect, it } from 'vitest';
import enter from './enter';

describe('enter', () => {
	it('splits the current line at the caret', () => {
		const { code } = enter(['abcd'], 0, 2);
		expect(code).toEqual(['ab', 'cd']);
	});

	it('moves the caret to the start of the next line', () => {
		const { row, col } = enter(['ab'], 0, 2);
		expect(row).toBe(1);
		expect(col).toBe(0);
	});
});
