import { WASM_F32_NEAREST, WASM_F64_NEAREST } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `round`.
 * @see [Instruction docs](../../docs/instructions/math-helpers.md)
 */
const round: InstructionCompiler = (line, context, facts) => {
	const [operand] = facts.stackAnalysis.consumedOperands;

	return saveByteCode(context, [operand.valueType === 'float64' ? WASM_F64_NEAREST : WASM_F32_NEAREST]);
};

export default round;
