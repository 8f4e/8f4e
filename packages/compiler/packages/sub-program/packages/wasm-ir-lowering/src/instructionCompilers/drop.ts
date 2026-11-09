import { WASM_DROP } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `drop`.
 * @see [Instruction docs](../../docs/instructions/stack.md)
 */
const drop: InstructionCompiler = (line, context) => {
	return saveByteCode(context, [WASM_DROP]);
};

export default drop;
