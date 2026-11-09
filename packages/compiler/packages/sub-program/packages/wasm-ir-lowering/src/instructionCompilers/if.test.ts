import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import _if from './if';

describe('if instruction compiler', () => {
	it('emits a void if block when the matching ifEnd declares no result', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			_if,
			{
				lineNumber: 1,
				instruction: 'if',
				arguments: [],
				ifBlock: { matchingIfEndIndex: 2, resultTypes: [], hasElse: false },
			},
			context
		);

		expect({
			blockStack: context.blockStack,
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('emits a void if block when given no arguments', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			_if,
			{
				lineNumber: 1,
				instruction: 'if',
				arguments: [],
				ifBlock: { matchingIfEndIndex: 2, resultTypes: [], hasElse: false },
			},
			context
		);

		expect({
			blockStack: context.blockStack,
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('emits a float if block', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			_if,
			{
				lineNumber: 1,
				instruction: 'if',
				arguments: [],
				ifBlock: { matchingIfEndIndex: 2, resultTypes: ['float'], hasElse: false },
			},
			context
		);

		expect({
			blockStack: context.blockStack,
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('emits an int if block', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			_if,
			{
				lineNumber: 1,
				instruction: 'if',
				arguments: [],
				ifBlock: { matchingIfEndIndex: 2, resultTypes: ['int'], hasElse: false },
			},
			context
		);

		expect({
			blockStack: context.blockStack,
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('lowers a multi-result if with a symbolic block type', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			_if,
			{
				lineNumber: 1,
				instruction: 'if',
				arguments: [],
				ifBlock: { matchingIfEndIndex: 2, resultTypes: ['int', 'float'], hasElse: false },
			},
			context
		);

		expect({
			blockStack: context.blockStack,
			instructions: context.instructions,
		}).toMatchSnapshot();
	});
});
