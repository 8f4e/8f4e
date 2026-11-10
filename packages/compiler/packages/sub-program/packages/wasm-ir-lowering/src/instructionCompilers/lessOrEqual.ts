import { WASM_F32_LE, WASM_F64_LE, WASM_I32_LE_S } from '@8f4e/compiler-wasm-utils';

import createNumericBinaryCompiler from './utils/createNumericBinaryCompiler';

/**
 * Instruction compiler for `lessOrEqual`.
 * @see [Instruction docs](../../docs/instructions/comparison.md)
 */
const lessOrEqual = createNumericBinaryCompiler({
	opcodes: {
		int32: WASM_I32_LE_S,
		float32: WASM_F32_LE,
		float64: WASM_F64_LE,
	},
});

export default lessOrEqual;
