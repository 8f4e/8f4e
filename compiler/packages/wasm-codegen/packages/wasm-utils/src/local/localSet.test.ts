import { expect, test } from 'vitest';

import localSet from './localSet';

test('localSet generates correct bytecode', () => {
	expect(localSet(1)).toStrictEqual([33, 1]);
	expect(localSet(32)).toStrictEqual([33, 32]);
	expect(localSet(256)).toStrictEqual([33, 128, 2]);
});
