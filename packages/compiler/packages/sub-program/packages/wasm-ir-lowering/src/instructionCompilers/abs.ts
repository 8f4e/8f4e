import {
	WASM_ELSE,
	WASM_END,
	WASM_F32_ABS,
	WASM_F64_ABS,
	WASM_I32_LT_S,
	WASM_I32_SUB,
	WASM_IF,
	WASM_TYPE_I32,
} from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { wasmLocalGet as localGet, wasmLocalSet as localSet } from '@8f4e/language-spec';
import { allocateLocal } from '../localStorage';
import { i32const } from '../operations';

import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `abs`.
 * @see [Instruction docs](../../docs/instructions/math-helpers.md)
 */
const abs: InstructionCompiler = (_line, context, facts) => {
	const [operand] = facts.stackAnalysis.consumedOperands;

	if (operand.valueType === 'int') {
		const valueLocalIndex = allocateLocal(context, { isInteger: true });

		return saveByteCode(context, [
			...localSet(valueLocalIndex),
			...localGet(valueLocalIndex),
			...i32const(0),
			WASM_I32_LT_S,
			{ kind: 'block', opcode: WASM_IF, results: [WASM_TYPE_I32] },
			...i32const(0),
			...localGet(valueLocalIndex),
			WASM_I32_SUB,
			WASM_ELSE,
			...localGet(valueLocalIndex),
			WASM_END,
		]);
	} else {
		return saveByteCode(context, [operand.valueType === 'float64' ? WASM_F64_ABS : WASM_F32_ABS]);
	}
};

export default abs;
