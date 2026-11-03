import { BlockType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import loopEnd from './loopEnd';

describe('loopEnd instruction compiler', () => {
	it('ends a loop block', () => {
		const context = createInstructionCompilerTestContext({
			blockStack: [
				...createInstructionCompilerTestContext().blockStack,
				{
					blockType: BlockType.LOOP,
					expectedResultTypes: [],
					loopCounterLocal: { isInteger: true, index: 0 },
				},
			],
		});

		compileInstructionForTest(
			loopEnd,
			{
				lineNumber: 1,
				instruction: 'loopEnd',
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
