import { expect, test } from 'vitest';
import { WASM_TYPE_VOID } from '../type';
import loop from './loop';

test('loop generates structure with branch back', () => {
	const result = loop(WASM_TYPE_VOID, [65, 1]);
	expect(result).toContain(3);
	expect(result).toContain(12);
	expect(result).toContain(11);
});
