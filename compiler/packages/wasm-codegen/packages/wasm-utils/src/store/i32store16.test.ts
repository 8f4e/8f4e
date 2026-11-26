import { expect, test } from 'vitest';

import i32store16 from './i32store16';

test('i32store16 with no setup generates only store16 instruction', () => {
	const result = i32store16();
	expect(result).toStrictEqual([0x3b, 1, 0]); // opcode 0x3b, alignment 1, offset 0
});

test('i32store16 with offset generates correct encoding', () => {
	const result = i32store16(undefined, undefined, 1, 4);
	expect(result).toStrictEqual([0x3b, 1, 4]);
});

test('i32store16 with address and value generates full instruction sequence', () => {
	const result = i32store16(100, 1234);
	expect(result).toContain(0x3b);
});
