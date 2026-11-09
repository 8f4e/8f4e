import { WASM_RETURN } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `return`.
 *
 * Emits a WebAssembly `return` instruction, immediately returning from the
 * enclosing function. Only valid inside a function block — not in a module.
 *
 * The return type is already declared by `functionEnd`; the WASM validator
 * ensures the stack matches. Takes no arguments.
 *
 * @see [Instruction docs](../../docs/instructions/blocks/function.md)
 */
const _return: InstructionCompiler = (line, context) => {
	saveByteCode(context, [WASM_RETURN]);

	return context;
};

export default _return;
