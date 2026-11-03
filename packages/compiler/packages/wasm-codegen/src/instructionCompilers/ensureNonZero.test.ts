import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import ensureNonZero from './ensureNonZero';

describe('ensureNonZero instruction compiler', () => {
	it('ensures integer operand is non-zero', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			ensureNonZero,
			{
				lineNumber: 1,
				instruction: 'ensureNonZero',
				arguments: [],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'int', isNonZero: false }] })
		);

		expect({
			locals: context.locals,
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('ensures float operand is non-zero with literal default', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			ensureNonZero,
			{
				lineNumber: 2,
				instruction: 'ensureNonZero',
				arguments: [{ type: ArgumentType.LITERAL, value: 2.5, isInteger: false }],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'float', isNonZero: false }] })
		);

		expect({
			locals: context.locals,
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('ensures float64 operand is non-zero with float64 default', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			ensureNonZero,
			{
				lineNumber: 3,
				instruction: 'ensureNonZero',
				arguments: [
					{
						type: ArgumentType.LITERAL,
						value: 2.5,
						isInteger: false,
					},
				],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'float64', isNonZero: false }] })
		);

		expect({
			locals: context.locals,
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
