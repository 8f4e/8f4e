import { WASM_F64_SQRT } from '@8f4e/compiler-wasm-utils';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import sqrt from './sqrt';

describe('sqrt instruction compiler', () => {
	it('emits F32_SQRT for float operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			sqrt,
			{
				lineNumber: 1,
				instruction: 'sqrt',
				arguments: [],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'float', isNonZero: true }] })
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('emits F64_SQRT for float64 operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			sqrt,
			{
				lineNumber: 1,
				instruction: 'sqrt',
				arguments: [],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'float64', isNonZero: true }] })
		);

		expect(context.byteCode).toEqual([WASM_F64_SQRT]);
	});
});
