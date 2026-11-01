import { WASM_F32_NEAREST, WASM_F64_NEAREST } from '@8f4e/compiler-wasm-utils';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import round from './round';

describe('round instruction compiler', () => {
	it('emits F32_NEAREST for float32 operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			round,
			{
				lineNumber: 1,
				instruction: 'round',
				arguments: [],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'float', isNonZero: true }] })
		);

		expect(context.byteCode).toEqual([WASM_F32_NEAREST]);
	});

	it('emits F64_NEAREST for float64 operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			round,
			{
				lineNumber: 1,
				instruction: 'round',
				arguments: [],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'float64', isNonZero: true }] })
		);

		expect(context.byteCode).toEqual([WASM_F64_NEAREST]);
	});
});
