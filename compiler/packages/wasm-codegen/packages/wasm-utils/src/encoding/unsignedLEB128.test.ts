import { expect, test } from 'vitest';

import unsignedLEB128 from './unsignedLEB128';

test('unsignedLEB128 encodes small values in single byte', () => {
	expect(unsignedLEB128(0)).toStrictEqual([0]);
	expect(unsignedLEB128(10)).toStrictEqual([10]);
});

test('unsignedLEB128 encodes larger values with continuation bytes', () => {
	expect(unsignedLEB128(127)).toStrictEqual([127]);
	expect(unsignedLEB128(128)).toStrictEqual([128, 1]);
	expect(unsignedLEB128(256)).toStrictEqual([128, 2]);
});
