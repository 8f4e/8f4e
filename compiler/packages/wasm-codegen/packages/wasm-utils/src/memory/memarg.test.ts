import { expect, test } from 'vitest';

import memarg from './memarg';

test('memarg encodes alignment and offset', () => {
	expect(memarg(2, 0)).toStrictEqual([2, 0]);
	expect(memarg(0, 16)).toStrictEqual([0, 16]);
});
