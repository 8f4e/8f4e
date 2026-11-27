import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import shiftRightUnsigned from './shiftRightUnsigned';

describe('shiftRightUnsigned instruction compiler', () => {
	it('emits I32_SHR_U for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			shiftRightUnsigned,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 1, instruction: 'shiftRightUnsigned', arguments: [] },
			context
		);

		expect({
			instructions: context.instructions,
		}).toMatchSnapshot();
	});
});
