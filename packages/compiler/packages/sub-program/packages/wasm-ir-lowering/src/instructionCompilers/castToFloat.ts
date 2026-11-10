import { WASM_F32_CONVERT_I32_S } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `castToFloat`.
 * @see [Instruction docs](../../docs/instructions/conversion.md)
 */
const castToFloat: InstructionCompiler = (line, context) => {
	return saveByteCode(context, [WASM_F32_CONVERT_I32_S]);
};

export default castToFloat;
