import { expect, test } from 'vitest';

import i32const from './i32const';

test('i32const generates correct bytecode for positive values', () => {
	expect(i32const(1)).toStrictEqual([65, 1]);
	expect(i32const(32)).toStrictEqual([65, 32]);
	expect(i32const(256)).toStrictEqual([65, 128, 2]);
});

test('i32const generates correct bytecode for negative values', () => {
	expect(i32const(-1)).toStrictEqual([65, 127]);
	expect(i32const(-256)).toStrictEqual([65, 128, 126]);
});
