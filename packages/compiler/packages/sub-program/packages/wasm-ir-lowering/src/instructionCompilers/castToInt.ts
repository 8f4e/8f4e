import {
	prefixedInstruction,
	WASM_MISC,
	WASM_MISC_I32_TRUNC_SAT_F32_S,
	WASM_MISC_I32_TRUNC_SAT_F64_S,
} from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `castToInt`.
 * @see [Instruction docs](../../docs/instructions/conversion.md)
 */
const castToInt: InstructionCompiler = (line, context, facts) => {
	const [operand] = facts.stackAnalysis.consumedOperands;

	// Use the non-trapping saturating conversion so NaN and out-of-range floats do not stop the runtime.
	return saveByteCode(
		context,
		prefixedInstruction(
			WASM_MISC,
			operand.valueType === 'float64' ? WASM_MISC_I32_TRUNC_SAT_F64_S : WASM_MISC_I32_TRUNC_SAT_F32_S
		)
	);
};

export default castToInt;
