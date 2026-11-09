import { WASM_F32_NE, WASM_F64_NE, WASM_I32_NE } from '@8f4e/compiler-wasm-utils';

import createNumericBinaryCompiler from './utils/createNumericBinaryCompiler';

/**
 * Instruction compiler for `notEqual`.
 * @see [Instruction docs](../../docs/instructions/comparison.md)
 */
const notEqual = createNumericBinaryCompiler({
	opcodes: {
		int32: WASM_I32_NE,
		float32: WASM_F32_NE,
		float64: WASM_F64_NE,
	},
});

export default notEqual;
