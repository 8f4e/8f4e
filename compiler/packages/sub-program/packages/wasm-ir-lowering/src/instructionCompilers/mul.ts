import { WASM_F32_MUL, WASM_F64_MUL, WASM_I32_MUL } from '@8f4e/compiler-wasm-utils';

import createNumericBinaryCompiler from './utils/createNumericBinaryCompiler';

/**
 * Instruction compiler for `mul`.
 * @see [Instruction docs](../../docs/instructions/arithmetic.md)
 */
const mul = createNumericBinaryCompiler({
	opcodes: {
		int32: WASM_I32_MUL,
		float32: WASM_F32_MUL,
		float64: WASM_F64_MUL,
	},
});

export default mul;
