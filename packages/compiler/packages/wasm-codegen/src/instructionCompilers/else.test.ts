import { BlockType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import _else from './else';

describe('else instruction compiler', () => {
	it('emits else bytecode and restores block', () => {
		const context = createInstructionCompilerTestContext({
			blockStack: [
				...createInstructionCompilerTestContext().blockStack,
				{
					blockType: BlockType.CONDITION,
					expectedResultTypes: ['int'],
				},
			],
		});

		compileInstructionForTest(
			_else,
			{
				lineNumber: 1,
				instruction: 'else',
				arguments: [],
			},
			context
		);

		expect({
			blockStack: context.blockStack,
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
