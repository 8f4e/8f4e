import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import notEqual from './notEqual';

describe('notEqual instruction compiler', () => {
	it('emits I32_NE for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			notEqual,
			{
				lineNumber: 1,
				instruction: 'notEqual',
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

	it('emits F32_NE for float operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			notEqual,
			{
				lineNumber: 1,
				instruction: 'notEqual',
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

	it('emits F64_NE for float64 operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			notEqual,
			{
				lineNumber: 1,
				instruction: 'notEqual',
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

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
