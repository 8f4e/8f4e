import { expect, test } from 'vitest';

import i32load16s from './i32load16s';

test('i32load16s generates correct bytecode', () => {
	expect(i32load16s()).toStrictEqual([46, 1, 0]);
});
