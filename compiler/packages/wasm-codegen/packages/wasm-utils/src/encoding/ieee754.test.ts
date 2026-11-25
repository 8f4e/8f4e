import { expect, test } from 'vitest';

import ieee754 from './ieee754';

test('ieee754 converts single-precision floats correctly', () => {
	expect(Array.from(ieee754(1))).toStrictEqual([0, 0, 128, 63]);
	expect(Array.from(ieee754(32))).toStrictEqual([0, 0, 0, 66]);
	expect(Array.from(ieee754(256))).toStrictEqual([0, 0, 128, 67]);
	expect(Array.from(ieee754(-1))).toStrictEqual([0, 0, 128, 191]);
	expect(Array.from(ieee754(-256))).toStrictEqual([0, 0, 128, 195]);
	expect(Array.from(ieee754(3.14))).toStrictEqual([195, 245, 72, 64]);
});
