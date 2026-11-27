import { WASM_I32_SHR_S } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `shiftRight`.
 * @see [Instruction docs](../../docs/instructions/bitwise.md)
 */
const shiftRight: InstructionCompiler = (line, context) => {
	return saveByteCode(context, [WASM_I32_SHR_S]);
};

export default shiftRight;
