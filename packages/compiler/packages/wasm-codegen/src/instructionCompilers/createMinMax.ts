import {
	localGet,
	localSet,
	WASM_ELSE,
	WASM_END,
	WASM_F32_MAX,
	WASM_F32_MIN,
	WASM_F64_MAX,
	WASM_F64_MIN,
	WASM_I32_GT_S,
	WASM_I32_LT_S,
	WASM_IF,
	WASM_TYPE_I32,
} from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { allocateTemporaryLocal } from '../localStorage';

import { saveByteCode } from './utils/saveByteCode';

const createMinMax =
	(instruction: 'min' | 'max'): InstructionCompiler =>
	(line, context, facts) => {
		const numericOperandKind = facts.numericOperandKind!;
		const isInteger = numericOperandKind === 'int32';
		const isFloat64 = numericOperandKind === 'float64';

		if (isInteger) {
			const leftLocal = allocateTemporaryLocal(context, {
				isInteger: true,
			});
			const rightLocal = allocateTemporaryLocal(context, {
				isInteger: true,
			});
			const leftLocalIndex = leftLocal.index;
			const rightLocalIndex = rightLocal.index;

			return saveByteCode(context, [
				...localSet(rightLocalIndex),
				...localSet(leftLocalIndex),
				...localGet(leftLocalIndex),
				...localGet(rightLocalIndex),
				instruction === 'min' ? WASM_I32_LT_S : WASM_I32_GT_S,
				WASM_IF,
				WASM_TYPE_I32,
				...localGet(leftLocalIndex),
				WASM_ELSE,
				...localGet(rightLocalIndex),
				WASM_END,
			]);
		}

		if (instruction === 'min') {
			return saveByteCode(context, [isFloat64 ? WASM_F64_MIN : WASM_F32_MIN]);
		}

		return saveByteCode(context, [isFloat64 ? WASM_F64_MAX : WASM_F32_MAX]);
	};

export default createMinMax;
