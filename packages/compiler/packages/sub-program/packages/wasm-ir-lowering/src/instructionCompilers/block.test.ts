import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import block from './block';

describe('block instruction compiler', () => {
	it('emits a typed block for float', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			block,
			{
				diagnosticSource: { kind: 'document' },
				lineNumber: 1,
				instruction: 'block',
				arguments: [],
				blockBlock: { matchingBlockEndIndex: 2, resultTypes: ['float'] },
			},
			context
		);

		expect({
			blockStack: context.blockStack,
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('emits a typed block for int', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			block,
			{
				diagnosticSource: { kind: 'document' },
				lineNumber: 1,
				instruction: 'block',
				arguments: [],
				blockBlock: { matchingBlockEndIndex: 2, resultTypes: ['int'] },
			},
			context
		);

		expect({
			blockStack: context.blockStack,
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('emits a void block when no result type is declared', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			block,
			{
				diagnosticSource: { kind: 'document' },
				lineNumber: 1,
				instruction: 'block',
				arguments: [],
				blockBlock: { matchingBlockEndIndex: 2, resultTypes: [] },
			},
			context
		);

		expect({
			blockStack: context.blockStack,
			instructions: context.instructions,
		}).toMatchSnapshot();
	});
});
