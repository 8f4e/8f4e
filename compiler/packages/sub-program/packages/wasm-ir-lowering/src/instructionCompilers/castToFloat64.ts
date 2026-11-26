import { WASM_F64_CONVERT_I32_S, WASM_F64_PROMOTE_F32 } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `castToFloat64`.
 * Casts int32 and float32 values to float64. Float64 input is a no-op.
 * @see [Instruction docs](../../docs/instructions/conversion.md)
 */
const castToFloat64: InstructionCompiler = (line, context, facts) => {
	const [operand] = facts.stackAnalysis.consumedOperands;

	if (operand.valueType === 'int') {
		return saveByteCode(context, [WASM_F64_CONVERT_I32_S]);
	}

	// Float64 input needs no opcode conversion.
	if (operand.valueType === 'float64') {
		return context;
	}

	return saveByteCode(context, [WASM_F64_PROMOTE_F32]);
};

export default castToFloat64;
