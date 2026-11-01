import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import branchIfTrue from './branchIfTrue';

describe('branchIfTrue instruction compiler', () => {
	it('emits br_if bytecode', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			branchIfTrue,
			{
				lineNumber: 1,
				instruction: 'branchIfTrue',
				arguments: [{ type: ArgumentType.LITERAL, value: 2, isInteger: true }],
			},
			context
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
