import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import shiftLeft from './shiftLeft';

describe('shiftLeft instruction compiler', () => {
	it('emits I32_SHL for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			shiftLeft,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 1, instruction: 'shiftLeft', arguments: [] },
			context
		);

		expect({
			instructions: context.instructions,
		}).toMatchSnapshot();
	});
});
