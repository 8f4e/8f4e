import { describe, expect, it } from 'vitest';
import insertText from './insertText';

describe('insertText', () => {
	it('inserts the character at the caret', () => {
		const { code } = insertText(['ac'], 0, 1, 'b');
		expect(code).toEqual(['abc']);
	});

	it('moves the caret one character to the right', () => {
		const { row, col } = insertText(['ab'], 0, 1, 'c');
		expect(row).toBe(0);
		expect(col).toBe(2);
	});
});

it('preserves line prefixes and suffixes across a multiline insertion', () => {
	expect(insertText(['beforeAfter', 'tail'], 0, 6, 'first\nsecond')).toEqual({
		code: ['beforefirst', 'secondAfter', 'tail'],
		row: 1,
		col: 6,
	});
});
