import {
	br,
	i32const,
	localGet,
	localSet,
	WASM_BLOCK,
	WASM_END,
	WASM_I32_ADD,
	WASM_I32_GE_S,
	WASM_IF,
	WASM_LOOP,
	WASM_TYPE_VOID,
} from '@8f4e/compiler-wasm-utils';
import type { CodegenLoopBlockStackFrame, InstructionCompiler, ResolvedLoopLine } from '@8f4e/language-spec';
import { BlockType } from '@8f4e/language-spec';
import { pushBlock } from '@8f4e/semantic-utils';
import { allocateTemporaryLocal } from '../localStorage';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `loop`.
 * @see [Instruction docs](../../docs/instructions/control-flow.md)
 */
const loop: InstructionCompiler<ResolvedLoopLine> = (line, context) => {
	const capArg = line.arguments[0];
	const effectiveCap = capArg.value;

	const loopCounterLocal = allocateTemporaryLocal(context, {
		isInteger: true,
	});
	const counterLocalIndex = loopCounterLocal.index;

	const loopBlock: CodegenLoopBlockStackFrame = {
		expectedResultTypes: [],
		blockType: BlockType.LOOP,
		loopCounterLocal,
	};

	pushBlock(context, loopBlock);

	return saveByteCode(context, [
		...i32const(0),
		...localSet(counterLocalIndex),
		WASM_BLOCK,
		WASM_TYPE_VOID,
		WASM_LOOP,
		WASM_TYPE_VOID,
		...localGet(counterLocalIndex),
		...i32const(effectiveCap),
		WASM_I32_GE_S,
		WASM_IF,
		WASM_TYPE_VOID,
		...br(2),
		WASM_END,
		...localGet(counterLocalIndex),
		...i32const(1),
		WASM_I32_ADD,
		...localSet(counterLocalIndex),
	]);
};

export default loop;
