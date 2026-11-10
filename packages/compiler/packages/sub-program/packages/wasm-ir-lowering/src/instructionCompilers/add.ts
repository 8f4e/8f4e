import { WASM_F32_ADD, WASM_F64_ADD, WASM_I32_ADD } from '@8f4e/compiler-wasm-utils';

import createNumericBinaryCompiler from './utils/createNumericBinaryCompiler';

/**
 * Instruction compiler for `add`.
 * @see [Instruction docs](../../docs/instructions/arithmetic.md)
 */
const add = createNumericBinaryCompiler({
	opcodes: {
		int32: WASM_I32_ADD,
		float32: WASM_F32_ADD,
		float64: WASM_F64_ADD,
	},
});

export default add;
