import { expect, test } from 'vitest';

import f64load from './f64load';

test('f64load generates correct bytecode', () => {
	expect(f64load()).toStrictEqual([43, 3, 0]);
	expect(f64load(0, 8)).toStrictEqual([43, 0, 8]);
});
