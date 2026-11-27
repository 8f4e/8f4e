import { expect, test } from 'vitest';

import createPassiveDataSegment from './createPassiveDataSegment';

test('createPassiveDataSegment creates a passive segment with byte vector', () => {
	expect(createPassiveDataSegment([1, 2, 3])).toStrictEqual([0x01, 0x03, 1, 2, 3]);
});
