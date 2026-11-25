import { expect, test } from 'vitest';
import { WASM_TYPE_I32 } from '../type';
import block from './block';

test('block generates correct structure', () => {
	const result = block(WASM_TYPE_I32, [65, 42]);
	expect(result).toStrictEqual([2, 127, 65, 42, 11]);
});
