import { expect, test } from 'vitest';

import localGet from './localGet';

test('localGet generates correct bytecode', () => {
	expect(localGet(1)).toStrictEqual([32, 1]);
	expect(localGet(32)).toStrictEqual([32, 32]);
	expect(localGet(256)).toStrictEqual([32, 128, 2]);
});
