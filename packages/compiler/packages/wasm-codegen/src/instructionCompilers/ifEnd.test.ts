import { BlockType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import ifEnd from './ifEnd';

describe('ifEnd instruction compiler', () => {
	it('ends a conditional block with result', () => {
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
			ifEnd,
			{
				lineNumber: 1,
				instruction: 'ifEnd',
				arguments: [],
			},
			context
		);

		expect({
			blockStack: context.blockStack,
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('ends a conditional block with multiple results', () => {
		const context = createInstructionCompilerTestContext({
			blockStack: [
				...createInstructionCompilerTestContext().blockStack,
				{
					blockType: BlockType.CONDITION,
					expectedResultTypes: ['int', 'float'],
				},
			],
		});

		compileInstructionForTest(
			ifEnd,
			{
				lineNumber: 1,
				instruction: 'ifEnd',
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
