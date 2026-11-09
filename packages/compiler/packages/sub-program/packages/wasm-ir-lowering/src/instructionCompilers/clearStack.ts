import { WASM_DROP } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `clearStack`.
 * @see [Instruction docs](../../docs/instructions/stack.md)
 */
const clearStack: InstructionCompiler = (line, context, facts) => {
	const length = facts.stackAnalysis.droppedStackItems?.length ?? facts.stackAnalysis.consumedOperands.length;

	return saveByteCode(context, new Array(length).fill(WASM_DROP));
};

export default clearStack;
