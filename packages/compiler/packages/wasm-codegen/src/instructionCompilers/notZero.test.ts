import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import notZero from './notZero';

describe('notZero instruction compiler', () => {
	it('emits I32_NE against zero for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			notZero,
			{
				lineNumber: 1,
				instruction: 'notZero',
				arguments: [],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'int', isNonZero: false }] })
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('emits float comparison segment', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			notZero,
			{
				lineNumber: 1,
				instruction: 'notZero',
				arguments: [],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'float', isNonZero: false }] })
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('emits F64_NE against zero for float64 operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			notZero,
			{
				lineNumber: 1,
				instruction: 'notZero',
				arguments: [],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'float64', isNonZero: false }] })
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
