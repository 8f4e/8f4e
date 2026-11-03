import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import branch from './branch';

describe('branch instruction compiler', () => {
	it('emits br bytecode', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			branch,
			{
				lineNumber: 1,
				instruction: 'branch',
				arguments: [{ type: ArgumentType.LITERAL, value: 0, isInteger: true }],
			},
			context
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
