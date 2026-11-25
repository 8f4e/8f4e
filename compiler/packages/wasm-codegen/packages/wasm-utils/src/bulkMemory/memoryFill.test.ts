import { expect, test } from 'vitest';

import memoryFill from './memoryFill';

test('memoryFill generates bulk-memory instruction bytes', () => {
	expect(memoryFill()).toStrictEqual([0xfc, 0x0b, 0x00]);
});
