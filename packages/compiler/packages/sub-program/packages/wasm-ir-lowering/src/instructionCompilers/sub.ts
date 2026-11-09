import { WASM_F32_SUB, WASM_F64_SUB, WASM_I32_SUB } from '@8f4e/compiler-wasm-utils';

import createNumericBinaryCompiler from './utils/createNumericBinaryCompiler';

/**
 * Instruction compiler for `sub`.
 * @see [Instruction docs](../../docs/instructions/arithmetic.md)
 */
const sub = createNumericBinaryCompiler({
	opcodes: {
		int32: WASM_I32_SUB,
		float32: WASM_F32_SUB,
		float64: WASM_F64_SUB,
	},
});

export default sub;
