import { WASM_F64_EQ } from '@8f4e/compiler-wasm-utils';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import equal from './equal';

describe('equal instruction compiler', () => {
	it('emits I32_EQ for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			equal,
			{
				lineNumber: 1,
				instruction: 'equal',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'int', isNonZero: false },
					{ kind: 'value', valueType: 'int', isNonZero: false },
				],
				numericOperandKind: 'int32',
			})
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('emits F32_EQ for float operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			equal,
			{
				lineNumber: 1,
				instruction: 'equal',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'float', isNonZero: false },
					{ kind: 'value', valueType: 'float', isNonZero: false },
				],
				numericOperandKind: 'float32',
			})
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('emits F64_EQ for float64 operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			equal,
			{
				lineNumber: 1,
				instruction: 'equal',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'float64', isNonZero: false },
					{ kind: 'value', valueType: 'float64', isNonZero: false },
				],
				numericOperandKind: 'float64',
			})
		);

		expect(context.byteCode).toEqual([WASM_F64_EQ]);
	});
});
