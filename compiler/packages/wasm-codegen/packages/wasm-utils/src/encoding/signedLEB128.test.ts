import { expect, test } from 'vitest';

import signedLEB128 from './signedLEB128';

test('signedLEB128 encodes positive values', () => {
	expect(signedLEB128(0)).toStrictEqual([0]);
	expect(signedLEB128(10)).toStrictEqual([10]);
});

test('signedLEB128 encodes negative values', () => {
	expect(signedLEB128(-10)).toStrictEqual([118]);
	expect(signedLEB128(-1)).toStrictEqual([127]);
});

test('signedLEB128 encodes larger negative values', () => {
	expect(signedLEB128(-123456)).toStrictEqual([192, 187, 120]);
	expect(signedLEB128(-256)).toStrictEqual([128, 126]);
});
