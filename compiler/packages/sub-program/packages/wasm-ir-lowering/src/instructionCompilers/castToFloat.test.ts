import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import castToFloat from './castToFloat';

describe('castToFloat instruction compiler', () => {
	it('converts int operand to float', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			castToFloat,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 1, instruction: 'castToFloat', arguments: [] },
			context
		);

		expect({
			instructions: context.instructions,
		}).toMatchSnapshot();
	});
});
