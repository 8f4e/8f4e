import {
	createCodeSection,
	createFunction,
	createFunctionSection,
	createFunctionType,
	createLocalDeclaration,
	createTypeSection,
	createWasmVersion,
	WASM_HEADER,
	WASM_TYPE_I32,
} from '@8f4e/compiler-wasm-utils';
import { ArgumentType, type CompilerASTLine, type ResolvedLoopLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	emitTestInstructions,
} from '../../tests/testUtils';
import loop from './loop';
import loopEnd from './loopEnd';

describe('loop instruction compiler', () => {
	it('emits valid Wasm with distinct counters for loops on the same source line', () => {
		const context = createInstructionCompilerTestContext();
		const open: ResolvedLoopLine = {
			lineNumber: 2,
			instruction: 'loop',
			arguments: [{ type: ArgumentType.LITERAL, value: 2, isInteger: true }],
		};
		const close: CompilerASTLine = { lineNumber: 3, instruction: 'loopEnd', arguments: [] };

		compileInstructionForTest(loop, open, context);
		compileInstructionForTest(loop, { ...open }, context);
		expect(context.activeLoopBlocks.map(block => block.loopCounterIndex)).toEqual([0, 1]);
		expect(context.locals).toHaveLength(2);
		compileInstructionForTest(loopEnd, close, context);
		compileInstructionForTest(loopEnd, { ...close }, context);

		const declarations = context.locals.map(() => createLocalDeclaration(WASM_TYPE_I32));
		const wasm = Uint8Array.from([
			...WASM_HEADER,
			...createWasmVersion(1),
			...createTypeSection([createFunctionType([])]),
			...createFunctionSection([0]),
			...createCodeSection([createFunction(declarations, emitTestInstructions(context))]),
		]);
		expect(WebAssembly.validate(wasm)).toBe(true);
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
			byteCode: emitTestInstructions(context),
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
			byteCode: emitTestInstructions(context),
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
			byteCode: emitTestInstructions(context),
		}).toMatchSnapshot();
	});
});
