import { expect, test } from 'vitest';

import createFunctionSection from './createFunctionSection';

test('createFunctionSection generates correct section', () => {
	expect(createFunctionSection([0])).toStrictEqual([3, 2, 1, 0]);
	expect(createFunctionSection([0, 1, 2])).toStrictEqual([3, 4, 3, 0, 1, 2]);
});

test('encodes type indices beyond the single-byte range and includes their encoded sizes', () => {
	expect(createFunctionSection([127, 128, 255, 256])).toStrictEqual([3, 8, 4, 127, 128, 1, 255, 1, 128, 2]);
});
