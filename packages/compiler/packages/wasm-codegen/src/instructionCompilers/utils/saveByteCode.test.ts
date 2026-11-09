import type { CodegenContext } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { saveByteCode } from './saveByteCode';

describe('saveByteCode', () => {
	it('saves bytecode to the context', () => {
		const context = {
			blockStack: [],
			instructions: [],
		} as unknown as CodegenContext;

		const result = saveByteCode(context, [1, 2, 3]);
		expect(result.instructions).toEqual([1, 2, 3]);
	});

	it('appends to existing bytecode', () => {
		const context = {
			blockStack: [],
			instructions: [1, 2],
		} as unknown as CodegenContext;

		const result = saveByteCode(context, [3, 4]);
		expect(result.instructions).toEqual([1, 2, 3, 4]);
	});
});
