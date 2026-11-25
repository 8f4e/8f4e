import { expect, test } from 'vitest';

import f32load from './f32load';

test('f32load generates correct bytecode', () => {
	expect(f32load()).toStrictEqual([42, 2, 0]);
	expect(f32load(0, 16)).toStrictEqual([42, 0, 16]);
});
