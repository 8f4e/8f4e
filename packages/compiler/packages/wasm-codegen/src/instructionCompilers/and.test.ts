import { describe, expect, it } from 'vitest';
import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import and from './and';

describe('and instruction compiler', () => {
	it('emits I32_AND for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			and,
			{
				lineNumber: 1,
				instruction: 'and',
				arguments: [],
			},
			context
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
