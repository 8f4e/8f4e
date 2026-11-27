import { expect, test } from 'vitest';

import call from './call';

test('call generates correct bytecode', () => {
	expect(call(1)).toStrictEqual([16, 1]);
	expect(call(32)).toStrictEqual([16, 32]);
	expect(call(256)).toStrictEqual([16, 128, 2]);
});
