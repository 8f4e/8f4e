import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import shiftRight from './shiftRight';

describe('shiftRight instruction compiler', () => {
	it('emits I32_SHR_S for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			shiftRight,
			{
				lineNumber: 1,
				instruction: 'shiftRight',
				arguments: [],
			},
			context
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
