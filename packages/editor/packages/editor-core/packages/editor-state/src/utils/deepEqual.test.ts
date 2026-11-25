import { describe, expect, it } from 'vitest';

import deepEqual from './deepEqual';

describe('deepEqual', () => {
	it('compares primitive values', () => {
		expect(deepEqual(1, 1)).toBe(true);
		expect(deepEqual('foo', 'foo')).toBe(true);
		expect(deepEqual(true, true)).toBe(true);
		expect(deepEqual(1, 2)).toBe(false);
	});

	it('compares nullish values', () => {
		expect(deepEqual(null, null)).toBe(true);
		expect(deepEqual(undefined, undefined)).toBe(true);
		expect(deepEqual(null, undefined)).toBe(false);
	});

	it('compares arrays', () => {
		expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
		expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
		expect(deepEqual([1, 2], [1, 3])).toBe(false);
	});

	it('compares plain objects', () => {
		expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
		expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
		expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
	});
});
