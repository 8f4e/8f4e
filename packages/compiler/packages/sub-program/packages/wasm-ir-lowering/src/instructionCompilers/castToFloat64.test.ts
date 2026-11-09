import { describe, expect, it } from 'vitest';
import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import castToFloat64 from './castToFloat64';

describe('castToFloat64 instruction compiler', () => {
	it('converts int operand to float64', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			castToFloat64,
			{ instruction: 'castToFloat64', lineNumber: 1, arguments: [] },
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'int', isNonZero: true }] })
		);

		expect({
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('promotes float32 operand to float64', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			castToFloat64,
			{ instruction: 'castToFloat64', lineNumber: 1, arguments: [] },
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'float', isNonZero: true }] })
		);

		expect({
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('is a no-op for float64 operand', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			castToFloat64,
			{ instruction: 'castToFloat64', lineNumber: 1, arguments: [] },
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'float64', isNonZero: true }] })
		);

		expect({
			instructions: context.instructions,
		}).toMatchSnapshot();
	});
});
