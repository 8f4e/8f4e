import { expect, test } from 'vitest';

import ieee754_64 from './ieee754_64';

test('ieee754_64 converts double-precision floats correctly', () => {
	expect(Array.from(ieee754_64(0))).toStrictEqual([0, 0, 0, 0, 0, 0, 0, 0]);
	expect(Array.from(ieee754_64(1))).toStrictEqual([0, 0, 0, 0, 0, 0, 240, 63]);
	expect(Array.from(ieee754_64(-1))).toStrictEqual([0, 0, 0, 0, 0, 0, 240, 191]);
	expect(Array.from(ieee754_64(3.14))).toStrictEqual([31, 133, 235, 81, 184, 30, 9, 64]);
});
