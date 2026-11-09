import { ArgumentType, type ResolvedLoopLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import loop from './loop';

describe('loop instruction compiler', () => {
	it('uses distinct counter bindings for loops on the same source line', () => {
		const context = createInstructionCompilerTestContext();
		const open: ResolvedLoopLine = {
			lineNumber: 2,
			instruction: 'loop',
			arguments: [{ type: ArgumentType.LITERAL, value: 2, isInteger: true }],
		};

		compileInstructionForTest(loop, open, context);
		compileInstructionForTest(loop, { ...open }, context);
		expect(context.activeLoopBlocks.map(block => block.loopCounterIndex)).toEqual([0, 1]);
		expect(context.locals).toHaveLength(2);
		const writes = context.instructions.flatMap(instruction =>
			typeof instruction !== 'number' && instruction.kind === 'local.set' ? [instruction.binding] : []
		);
		expect(writes).toEqual([0, 0, 1, 1]);
	});

	it('compiles the loop segment with default cap', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			loop,
			{
				lineNumber: 2,
				instruction: 'loop',
				arguments: [{ type: ArgumentType.LITERAL, value: 1000, isInteger: true }],
			},
			context
		);

		expect({
			blockStack: context.blockStack,
			locals: context.locals,
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('compiles the loop segment with explicit cap argument', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			loop,
			{
				lineNumber: 2,
				instruction: 'loop',
				arguments: [{ type: ArgumentType.LITERAL, value: 32, isInteger: true }],
			},
			context
		);

		expect({
			blockStack: context.blockStack,
			locals: context.locals,
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('compiles a smaller resolved cap', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			loop,
			{
				lineNumber: 2,
				instruction: 'loop',
				arguments: [{ type: ArgumentType.LITERAL, value: 10, isInteger: true }],
			},
			context
		);

		expect({
			blockStack: context.blockStack,
			locals: context.locals,
			instructions: context.instructions,
		}).toMatchSnapshot();
	});
});
