import { WASM_DROP, WASM_END, WASM_IF, WASM_RETURN } from '@8f4e/compiler-wasm-utils';
import type { ExitIfTrueLine, InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `exitIfTrue`.
 *
 * Consumes an integer condition from the stack. If the condition is non-zero,
 * exits the enclosing module immediately and drops any currently stacked values.
 * Otherwise execution continues normally.
 *
 * Only valid inside module blocks.
 *
 * @see [Instruction docs](../../docs/instructions/control-flow.md)
 */
const exitIfTrue: InstructionCompiler<ExitIfTrueLine> = (line, context, facts) => {
	const drops = (facts.stackAnalysis.droppedStackItems ?? []).flatMap(() => [WASM_DROP]);

	return saveByteCode(context, [{ kind: 'block', opcode: WASM_IF, results: [] }, ...drops, WASM_RETURN, WASM_END]);
};

export default exitIfTrue;
