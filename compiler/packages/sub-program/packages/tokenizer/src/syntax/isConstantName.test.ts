import { describe, expect, it } from 'vitest';

import isConstantName from './isConstantName';

describe('isConstantName', () => {
	it('accepts uppercase identifiers', () => {
		expect(isConstantName('FOO')).toBe(true);
		expect(isConstantName('A1_B-2')).toBe(true);
	});

	it('rejects lowercase starts', () => {
		expect(isConstantName('foo')).toBe(false);
	});

	it('rejects mixed case', () => {
		expect(isConstantName('Foo')).toBe(false);
	});
});
