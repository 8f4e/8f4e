import { WASM_I32_AND } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `and`.
 * @see [Instruction docs](../../docs/instructions/bitwise.md)
 */
const and: InstructionCompiler = (line, context) => {
	return saveByteCode(context, [WASM_I32_AND]);
};

export default and;
