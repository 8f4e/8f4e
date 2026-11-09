import { i32const, localGet, WASM_I32_SUB } from '@8f4e/compiler-wasm-utils';
import { BlockType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import loopIndex from './loopIndex';

describe('loopIndex instruction compiler', () => {
	it('reads the nearest active loop counter as a zero-based index', () => {
		const loopCounterLocal = { isInteger: true, index: 0 };
		const context = createInstructionCompilerTestContext({
			locals: [loopCounterLocal],
			blockStack: [
				{
					blockType: BlockType.MODULE,
					expectedResultTypes: [],
				},
				{
					blockType: BlockType.LOOP,
					expectedResultTypes: [],
					loopCounterLocal,
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

		expect(context.byteCode).toEqual([...localGet(0), ...i32const(1), WASM_I32_SUB]);
	});

	it('uses the innermost loop when nested', () => {
		const outerLoopCounterLocal = { isInteger: true, index: 0 };
		const innerLoopCounterLocal = { isInteger: true, index: 1 };
		const context = createInstructionCompilerTestContext({
			locals: [outerLoopCounterLocal, innerLoopCounterLocal],
			blockStack: [
				{
					blockType: BlockType.MODULE,
					expectedResultTypes: [],
				},
				{
					blockType: BlockType.LOOP,
					expectedResultTypes: [],
					loopCounterLocal: outerLoopCounterLocal,
				},
				{
					blockType: BlockType.LOOP,
					expectedResultTypes: [],
					loopCounterLocal: innerLoopCounterLocal,
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

		expect(context.byteCode).toEqual([...localGet(1), ...i32const(1), WASM_I32_SUB]);
	});
});
