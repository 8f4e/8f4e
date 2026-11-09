import { i32const, WASM_I32_SUB } from '@8f4e/compiler-wasm-utils';
import { BlockType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import loopIndex from './loopIndex';

describe('loopIndex instruction compiler', () => {
	it('reads the nearest active loop counter as a zero-based index', () => {
		const context = createInstructionCompilerTestContext({
			locals: [{ isInteger: true }],
			blockStack: [
				{
					blockType: BlockType.MODULE,
					expectedResultTypes: [],
				},
				{
					blockType: BlockType.LOOP,
					expectedResultTypes: [],
					loopCounterIndex: 0,
				},
			],
		});

		compileInstructionForTest(
			loopIndex,
			{
				lineNumber: 10,
				instruction: 'loopIndex',
				arguments: [],
			},
			context
		);

		expect(context.instructions).toEqual([{ kind: 'local.get', binding: 0 }, ...i32const(1), WASM_I32_SUB]);
	});

	it('uses the innermost loop when nested', () => {
		const context = createInstructionCompilerTestContext({
			locals: [{ isInteger: true }, { isInteger: true }],
			blockStack: [
				{
					blockType: BlockType.MODULE,
					expectedResultTypes: [],
				},
				{
					blockType: BlockType.LOOP,
					expectedResultTypes: [],
					loopCounterIndex: 0,
				},
				{
					blockType: BlockType.LOOP,
					expectedResultTypes: [],
					loopCounterIndex: 1,
				},
			],
		});

		compileInstructionForTest(
			loopIndex,
			{
				lineNumber: 10,
				instruction: 'loopIndex',
				arguments: [],
			},
			context
		);

		expect(context.instructions).toEqual([{ kind: 'local.get', binding: 1 }, ...i32const(1), WASM_I32_SUB]);
	});
});
