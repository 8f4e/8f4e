import { WASM_F32_GT, WASM_F64_GT, WASM_I32_GT_S } from '@8f4e/compiler-wasm-utils';

import createNumericBinaryCompiler from './utils/createNumericBinaryCompiler';

/**
 * Instruction compiler for `greaterThan`.
 * @see [Instruction docs](../../docs/instructions/comparison.md)
 */
const greaterThan = createNumericBinaryCompiler({
	opcodes: {
		int32: WASM_I32_GT_S,
		float32: WASM_F32_GT,
		float64: WASM_F64_GT,
	},
});

export default greaterThan;
