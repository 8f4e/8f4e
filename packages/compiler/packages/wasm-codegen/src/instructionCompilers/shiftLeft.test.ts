import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	emitTestInstructions,
} from '../../tests/testUtils';
import shiftLeft from './shiftLeft';

describe('shiftLeft instruction compiler', () => {
	it('emits I32_SHL for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			shiftLeft,
			{
				lineNumber: 1,
				instruction: 'shiftLeft',
				arguments: [],
			},
			context
		);

		expect({
			byteCode: emitTestInstructions(context),
		}).toMatchSnapshot();
	});
});
