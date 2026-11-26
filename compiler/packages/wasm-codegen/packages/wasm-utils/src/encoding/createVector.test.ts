import { expect, test } from 'vitest';

import createVector from './createVector';

test('createVector prefixes data with length', () => {
	expect(createVector([1, 2, 3])).toStrictEqual([3, 1, 2, 3]);
	expect(createVector([42])).toStrictEqual([1, 42]);
});

test('createVector handles empty data', () => {
	expect(createVector([])).toStrictEqual([0]);
});
