import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import or from './or';

describe('or instruction compiler', () => {
	it('emits I32_OR', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			or,
			{
				lineNumber: 1,
				instruction: 'or',
				arguments: [],
			},
			context
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
