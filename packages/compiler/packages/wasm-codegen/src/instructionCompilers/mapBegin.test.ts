import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import mapBegin from './mapBegin';

const { classifyIdentifier } = await import('@8f4e/tokenizer');

describe('mapBegin instruction compiler', () => {
	it('opens a map block for int input type', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			mapBegin,
			{
				lineNumber: 1,
				instruction: 'mapBegin',
				arguments: [classifyIdentifier('int')],
			},
			context
		);

		expect({
			blockStack: context.blockStack,
		}).toMatchSnapshot();
	});

	it('opens a map block for float input type', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			mapBegin,
			{
				lineNumber: 1,
				instruction: 'mapBegin',
				arguments: [classifyIdentifier('float')],
			},
			context
		);

		expect({
			blockStack: context.blockStack,
		}).toMatchSnapshot();
	});

	it('opens a map block for float64 input type', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			mapBegin,
			{
				lineNumber: 1,
				instruction: 'mapBegin',
				arguments: [classifyIdentifier('float64')],
			},
			context
		);

		expect({
			blockStack: context.blockStack,
		}).toMatchSnapshot();
	});
});
