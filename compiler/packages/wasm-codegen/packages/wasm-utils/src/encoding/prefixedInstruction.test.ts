import { expect, test } from 'vitest';

import prefixedInstruction from './prefixedInstruction';

test('encodes a prefixed instruction with a one-byte sub-opcode', () => {
	expect(prefixedInstruction(0xfc, 0x02)).toEqual([0xfc, 0x02]);
});

test('encodes a prefixed instruction with an unsigned LEB128 sub-opcode', () => {
	expect(prefixedInstruction(0xfc, 0x80)).toEqual([0xfc, 0x80, 0x01]);
});
