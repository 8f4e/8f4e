import { describe, expect, it } from 'vitest';
import typeCharacter from './type';

describe('type', () => {
	it('inserts the character at the caret', () => {
		const { code } = typeCharacter(['ac'], 0, 1, 'b');
		expect(code).toEqual(['abc']);
	});

	it('moves the caret one character to the right', () => {
		const { row, col } = typeCharacter(['ab'], 0, 1, 'c');
		expect(row).toBe(0);
		expect(col).toBe(2);
	});
});
