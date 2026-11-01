import { WASM_F64_LE } from '@8f4e/compiler-wasm-utils';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import lessOrEqual from './lessOrEqual';

describe('lessOrEqual instruction compiler', () => {
	it('emits I32_LE_S for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			lessOrEqual,
			{
				lineNumber: 1,
				instruction: 'lessOrEqual',
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

	it('emits F32_LE for float operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			lessOrEqual,
			{
				lineNumber: 1,
				instruction: 'lessOrEqual',
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

	it('emits F64_LE for float64 operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			lessOrEqual,
			{
				lineNumber: 1,
				instruction: 'lessOrEqual',
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

		expect(context.byteCode).toEqual([WASM_F64_LE]);
	});
});
