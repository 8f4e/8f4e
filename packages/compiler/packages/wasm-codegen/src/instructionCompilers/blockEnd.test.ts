import { BlockType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import blockEnd from './blockEnd';

describe('blockEnd instruction compiler', () => {
	it('emits the end of a block with a result', () => {
		const context = createInstructionCompilerTestContext({
			blockStack: [
				...createInstructionCompilerTestContext().blockStack,
				{
					blockType: BlockType.BLOCK,
					expectedResultTypes: ['int'],
				},
			],
		});

		compileInstructionForTest(
			blockEnd,
			{
				lineNumber: 1,
				instruction: 'blockEnd',
				arguments: [],
			},
			context
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
