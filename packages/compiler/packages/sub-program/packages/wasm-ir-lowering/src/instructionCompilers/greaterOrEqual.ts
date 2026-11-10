import { WASM_F32_GE, WASM_F64_GE, WASM_I32_GE_S } from '@8f4e/compiler-wasm-utils';

import createNumericBinaryCompiler from './utils/createNumericBinaryCompiler';

/**
 * Instruction compiler for `greaterOrEqual`.
 * @see [Instruction docs](../../docs/instructions/comparison.md)
 */
const greaterOrEqual = createNumericBinaryCompiler({
	opcodes: {
		int32: WASM_I32_GE_S,
		float32: WASM_F32_GE,
		float64: WASM_F64_GE,
	},
});

export default greaterOrEqual;
