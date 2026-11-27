import { expect, test } from 'vitest';

import memoryInit from './memoryInit';

test('memoryInit generates bulk-memory instruction bytes', () => {
	expect(memoryInit(2)).toStrictEqual([0xfc, 0x08, 0x02, 0x00]);
});
