import { describe, expect, it } from 'vitest';
import createInstructionCompilerTestContext from '../tests/testUtils';
import { createCodegenContext } from './createCodegenContext';
import { allocateLocal } from './localStorage';

describe('WebAssembly local storage', () => {
	it('appends scratch locals in Wasm slot order', () => {
		const context = createInstructionCompilerTestContext();
		const first = allocateLocal(context, { isInteger: true });
		const second = allocateLocal(context, { isInteger: false, isFloat64: true });

		expect([first, second]).toEqual([0, 1]);
		expect(context.locals).toEqual([{ isInteger: true }, { isInteger: false, isFloat64: true }]);
	});

	it('allocates parameters and source locals before scratch slots', () => {
		const context = createCodegenContext({}, [
			{ id: 0, name: 'pointer', type: 'float64*' },
			{ id: 1, name: 'value', type: 'float64' },
		]);
		const scratch = allocateLocal(context, { isInteger: true });

		expect(context.locals).toEqual([
			{ isInteger: true, pointeeBaseType: 'float64', pointerDepth: 1 },
			{ isInteger: false, isFloat64: true },
			{ isInteger: true },
		]);
		expect(scratch).toBe(2);
	});
});
