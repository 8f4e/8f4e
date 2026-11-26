import { expect, test } from 'vitest';

import i32load8u from './i32load8u';

test('i32load8u generates correct bytecode', () => {
	expect(i32load8u()).toStrictEqual([45, 0, 0]);
});
