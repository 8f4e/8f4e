import { expect, test } from 'vitest';

import br from './br';

test('br generates correct bytecode', () => {
	expect(br(0)).toStrictEqual([12, 0]);
	expect(br(2)).toStrictEqual([12, 2]);
});
