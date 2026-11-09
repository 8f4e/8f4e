import { WASM_I32_SHR_U } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `shiftRightUnsigned`.
 * @see [Instruction docs](../../docs/instructions/bitwise.md)
 */
const shiftRightUnsigned: InstructionCompiler = (line, context) => {
	return saveByteCode(context, [WASM_I32_SHR_U]);
};

export default shiftRightUnsigned;
