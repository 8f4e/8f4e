import { expect, test } from 'vitest';

import memoryCopy from './memoryCopy';

test('memoryCopy generates bulk-memory instruction bytes', () => {
	expect(memoryCopy()).toStrictEqual([0xfc, 0x0a, 0x00, 0x00]);
});
