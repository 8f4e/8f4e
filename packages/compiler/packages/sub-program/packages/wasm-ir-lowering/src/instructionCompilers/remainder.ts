import { WASM_I32_REM_S } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `remainder`.
 * @see [Instruction docs](../../docs/instructions/arithmetic.md)
 */
const remainder: InstructionCompiler = (line, context) => {
	return saveByteCode(context, [WASM_I32_REM_S]);
};

export default remainder;
