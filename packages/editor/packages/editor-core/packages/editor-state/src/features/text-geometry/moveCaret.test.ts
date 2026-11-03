import { describe, expect, it } from 'vitest';
import { moveCaret } from './moveCaret';

describe('moveCaret', () => {
	const code = ['abc', 'd', 'ef'];

	it('moves up and clamps column to the new line length', () => {
		expect(moveCaret(code, 1, 2, 'up')).toEqual([0, 2]);
		expect(moveCaret(code, 2, 2, 'up')).toEqual([1, 1]);
	});

	it('moves down and clamps column to the new line length', () => {
		expect(moveCaret(code, 0, 2, 'down')).toEqual([1, 1]);
		expect(moveCaret(code, 1, 0, 'down')).toEqual([2, 0]);
	});

	it('moves horizontally within the same line', () => {
		expect(moveCaret(code, 0, 0, 'left')).toEqual([0, 0]);
		expect(moveCaret(code, 0, 0, 'right')).toEqual([0, 1]);
		expect(moveCaret(code, 0, 3, 'right')).toEqual([0, 3]);
	});

	it('jumps to bounded coordinates', () => {
		expect(moveCaret(code, 5, 10, 'jump')).toEqual([2, 2]);
		expect(moveCaret(code, 1, -2, 'jump')).toEqual([1, 0]);
	});
});
