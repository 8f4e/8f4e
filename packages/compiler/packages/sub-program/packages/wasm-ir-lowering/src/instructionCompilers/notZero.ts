import { f32const, f64const, i32const, WASM_F32_NE, WASM_F64_NE, WASM_I32_NE } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `notZero`.
 * @see [Instruction docs](../../docs/instructions/comparison.md)
 */
const notZero: InstructionCompiler = (line, context, facts) => {
	const [operand] = facts.stackAnalysis.consumedOperands;

	if (operand.valueType === 'int') {
		return saveByteCode(context, [...i32const(0), WASM_I32_NE]);
	} else if (operand.valueType === 'float64') {
		return saveByteCode(context, [...f64const(0), WASM_F64_NE]);
	} else {
		return saveByteCode(context, [...f32const(0), WASM_F32_NE]);
	}
};

export default notZero;
