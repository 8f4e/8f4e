import { describe, expect, it } from 'vitest';
import createInstructionCompilerTestContext from '../tests/testUtils';
import { createCodegenContext } from './createCodegenContext';
import { allocateLocal } from './localStorage';

describe('WebAssembly local storage', () => {
	it('appends scratch locals in Wasm slot order', () => {
		const context = createInstructionCompilerTestContext();
		const first = allocateLocal(context, { isInteger: true });
		const second = allocateLocal(context, { isInteger: false, isFloat64: true });

		expect(first.index).toBe(0);
		expect(second.index).toBe(1);
		expect(context.locals).toEqual([first, second]);
	});

	it('allocates parameters and source locals before scratch slots', () => {
		const { functionLayout } = createInstructionCompilerTestContext();
		const context = createCodegenContext({ functionLayout }, [
			{ id: 0, name: 'pointer', type: 'float64*', parameterIndex: 0 },
			{ id: 1, name: 'value', type: 'float64' },
		]);
		const scratch = allocateLocal(context, { isInteger: true });

		expect(context.locals).toEqual([
			{ index: 0, isInteger: true, pointeeBaseType: 'float64', pointerDepth: 1 },
			{ index: 1, isInteger: false, isFloat64: true },
			{ index: 2, isInteger: true },
		]);
		expect(scratch).toBe(context.locals[2]);
	});
});
