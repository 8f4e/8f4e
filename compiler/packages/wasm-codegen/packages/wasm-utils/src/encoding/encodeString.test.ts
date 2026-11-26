import { expect, test } from 'vitest';

import encodeString from './encodeString';

test('encodeString prefixes string with length', () => {
	expect(encodeString('a')).toStrictEqual([1, 97]);
	expect(encodeString('ab')).toStrictEqual([2, 97, 98]);
});

test('encodeString handles empty string', () => {
	expect(encodeString('')).toStrictEqual([0]);
});

test('encodeString handles longer strings', () => {
	const result = encodeString('hello');
	expect(result).toStrictEqual([5, 104, 101, 108, 108, 111]);
});
