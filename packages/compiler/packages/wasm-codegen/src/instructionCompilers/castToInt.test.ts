import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import castToInt from './castToInt';

describe('castToInt instruction compiler', () => {
	it('converts float operand to int', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			castToInt,
			{
				lineNumber: 1,
				instruction: 'castToInt',
				arguments: [],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'float', isNonZero: true }] })
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('converts float64 operand to int', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			castToInt,
			{
				lineNumber: 1,
				instruction: 'castToInt',
				arguments: [],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'float64', isNonZero: true }] })
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
