import { expect, test } from 'vitest';

import i32store8 from './i32store8';

test('i32store8 with no setup generates only store8 instruction', () => {
	const result = i32store8();
	expect(result).toStrictEqual([0x3a, 0, 0]); // opcode 0x3a, alignment 0, offset 0
});

test('i32store8 with offset generates correct encoding', () => {
	const result = i32store8(undefined, undefined, 0, 5);
	expect(result).toStrictEqual([0x3a, 0, 5]);
});

test('i32store8 with address and value generates full instruction sequence', () => {
	const result = i32store8(100, 72);
	expect(result).toContain(0x3a);
});
