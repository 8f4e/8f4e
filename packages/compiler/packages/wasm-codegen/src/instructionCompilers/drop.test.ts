import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import drop from './drop';

describe('drop instruction compiler', () => {
	it('drops the top stack value', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			drop,
			{
				lineNumber: 1,
				instruction: 'drop',
				arguments: [],
			},
			context
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
