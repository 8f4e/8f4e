import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import abs from './abs';

describe('abs instruction compiler', () => {
	it('emits F32_ABS for float operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			abs,
			{
				lineNumber: 1,
				instruction: 'abs',
				arguments: [],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'float', isNonZero: true }] })
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('compiles int abs via segment instructions', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			abs,
			{
				lineNumber: 3,
				instruction: 'abs',
				arguments: [],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'int', isNonZero: true }] })
		);

		expect({
			byteCode: context.byteCode,
			locals: context.locals,
		}).toMatchSnapshot();
	});

	it('emits F64_ABS for float64 operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			abs,
			{
				lineNumber: 2,
				instruction: 'abs',
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
