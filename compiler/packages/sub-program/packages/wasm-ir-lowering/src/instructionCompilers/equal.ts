import { WASM_F32_EQ, WASM_F64_EQ, WASM_I32_EQ } from '@8f4e/compiler-wasm-utils';

import createNumericBinaryCompiler from './utils/createNumericBinaryCompiler';

/**
 * Instruction compiler for `equal`.
 * @see [Instruction docs](../../docs/instructions/comparison.md)
 */
const equal = createNumericBinaryCompiler({
	opcodes: {
		int32: WASM_I32_EQ,
		float32: WASM_F32_EQ,
		float64: WASM_F64_EQ,
	},
});

export default equal;
