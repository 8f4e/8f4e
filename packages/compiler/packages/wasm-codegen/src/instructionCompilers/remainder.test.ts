import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	emitTestInstructions,
} from '../../tests/testUtils';
import remainder from './remainder';

describe('remainder instruction compiler', () => {
	it('emits I32_REM_S for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			remainder,
			{
				lineNumber: 1,
				instruction: 'remainder',
				arguments: [],
			},
			context
		);

		expect({
			byteCode: emitTestInstructions(context),
		}).toMatchSnapshot();
	});
});
