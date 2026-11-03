import { describe, expect, it } from 'vitest';
import insertCharacter from './insertCharacter';

describe('insertCharacter', () => {
	it('inserts the character at the caret', () => {
		const { code } = insertCharacter(['ac'], 0, 1, 'b');
		expect(code).toEqual(['abc']);
	});

	it('moves the caret one character to the right', () => {
		const { row, col } = insertCharacter(['ab'], 0, 1, 'c');
		expect(row).toBe(0);
		expect(col).toBe(2);
	});
});
