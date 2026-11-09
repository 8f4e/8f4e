import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	emitTestInstructions,
} from '../../tests/testUtils';
import xor from './xor';

describe('xor instruction compiler', () => {
	it('emits I32_XOR for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			xor,
			{
				lineNumber: 1,
				instruction: 'xor',
				arguments: [],
			},
			context
		);

		expect({
			byteCode: emitTestInstructions(context),
		}).toMatchSnapshot();
	});
});
