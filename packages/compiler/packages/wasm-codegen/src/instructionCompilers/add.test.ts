import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import add from './add';

describe('add instruction compiler', () => {
	it('emits I32_ADD for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			add,
			{
				lineNumber: 1,
				instruction: 'add',
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

	it('emits F32_ADD for float32 operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			add,
			{
				lineNumber: 1,
				instruction: 'add',
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

	it('emits F64_ADD for float64 operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			add,
			{
				lineNumber: 1,
				instruction: 'add',
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
