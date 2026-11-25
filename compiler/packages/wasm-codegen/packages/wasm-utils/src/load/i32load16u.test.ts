import { expect, test } from 'vitest';

import i32load16u from './i32load16u';

test('i32load16u generates correct bytecode', () => {
	expect(i32load16u()).toStrictEqual([47, 1, 0]);
});
