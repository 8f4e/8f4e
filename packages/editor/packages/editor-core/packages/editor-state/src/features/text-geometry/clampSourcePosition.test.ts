import { expect, it } from 'vitest';
import { clampSourcePosition } from './clampSourcePosition';

it('bounds source rows and columns for text selection', () => {
	const code = ['abc', 'd', 'ef'];
	expect(clampSourcePosition(code, 5, 10)).toEqual([2, 2]);
	expect(clampSourcePosition(code, -1, 2)).toEqual([0, 2]);
	expect(clampSourcePosition(code, 1, -2)).toEqual([1, 0]);
});
