import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	emitTestInstructions,
} from '../../tests/testUtils';
import shiftRightUnsigned from './shiftRightUnsigned';

describe('shiftRightUnsigned instruction compiler', () => {
	it('emits I32_SHR_U for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			shiftRightUnsigned,
			{
				lineNumber: 1,
				instruction: 'shiftRightUnsigned',
				arguments: [],
			},
			context
		);

		expect({
			byteCode: emitTestInstructions(context),
		}).toMatchSnapshot();
	});
});
