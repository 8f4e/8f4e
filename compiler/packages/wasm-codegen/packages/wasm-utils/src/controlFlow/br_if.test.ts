import { expect, test } from 'vitest';

import br_if from './br_if';

test('br_if generates correct bytecode', () => {
	expect(br_if(0)).toStrictEqual([13, 0]);
	expect(br_if(1)).toStrictEqual([13, 1]);
});
