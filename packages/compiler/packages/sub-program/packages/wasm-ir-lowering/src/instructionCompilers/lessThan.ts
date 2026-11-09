import { WASM_F32_LT, WASM_F64_LT, WASM_I32_LT_S } from '@8f4e/compiler-wasm-utils';

import createNumericBinaryCompiler from './utils/createNumericBinaryCompiler';

/**
 * Instruction compiler for `lessThan`.
 * @see [Instruction docs](../../docs/instructions/comparison.md)
 */
const lessThan = createNumericBinaryCompiler({
	opcodes: {
		int32: WASM_I32_LT_S,
		float32: WASM_F32_LT,
		float64: WASM_F64_LT,
	},
});

export default lessThan;
