import { WASM_I32_SHL } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `shiftLeft`.
 * @see [Instruction docs](../../docs/instructions/bitwise.md)
 */
const shiftLeft: InstructionCompiler = (line, context) => {
	return saveByteCode(context, [WASM_I32_SHL]);
};

export default shiftLeft;
