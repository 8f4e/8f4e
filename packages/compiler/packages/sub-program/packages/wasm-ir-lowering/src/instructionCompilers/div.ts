import { WASM_F32_DIV, WASM_F64_DIV, WASM_I32_DIV_S } from '@8f4e/compiler-wasm-utils';

import createNumericBinaryCompiler from './utils/createNumericBinaryCompiler';

/**
 * Instruction compiler for `div`.
 * @see [Instruction docs](../../docs/instructions/arithmetic.md)
 */
const div = createNumericBinaryCompiler({
	opcodes: {
		int32: WASM_I32_DIV_S,
		float32: WASM_F32_DIV,
		float64: WASM_F64_DIV,
	},
});

export default div;
