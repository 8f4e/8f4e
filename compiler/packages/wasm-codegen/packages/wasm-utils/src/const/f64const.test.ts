import { expect, test } from 'vitest';

import f64const from './f64const';

test('f64const generates correct bytecode for 0', () => {
	expect(f64const(0)).toStrictEqual([68, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test('f64const generates correct bytecode for 1', () => {
	expect(f64const(1)).toStrictEqual([68, 0, 0, 0, 0, 0, 0, 240, 63]);
});
