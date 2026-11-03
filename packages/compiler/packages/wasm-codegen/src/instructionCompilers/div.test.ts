import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import div from './div';

describe('div instruction compiler', () => {
	it('emits I32_DIV_S for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			div,
			{
				lineNumber: 1,
				instruction: 'div',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'int', isNonZero: true },
					{ kind: 'value', valueType: 'int', isNonZero: true },
				],
				numericOperandKind: 'int32',
			})
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('emits F32_DIV for float32 operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			div,
			{
				lineNumber: 1,
				instruction: 'div',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'float', isNonZero: true },
					{ kind: 'value', valueType: 'float', isNonZero: true },
				],
				numericOperandKind: 'float32',
			})
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('emits F64_DIV for float64 operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			div,
			{
				lineNumber: 1,
				instruction: 'div',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'float64', isNonZero: true },
					{ kind: 'value', valueType: 'float64', isNonZero: true },
				],
				numericOperandKind: 'float64',
			})
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
