import { expect, test } from 'vitest';

import createFunctionName from './createFunctionName';

test('createFunctionName generates correct entry', () => {
	const name = createFunctionName(0, 'main');
	expect(name[0]).toBe(0);
});
