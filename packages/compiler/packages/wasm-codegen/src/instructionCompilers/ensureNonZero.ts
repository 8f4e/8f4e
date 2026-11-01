import {
	f32const,
	f64const,
	i32const,
	localGet,
	localSet,
	WASM_ELSE,
	WASM_END,
	WASM_F32_EQ,
	WASM_F64_EQ,
	WASM_I32_EQZ,
	WASM_IF,
	WASM_TYPE_I32,
	WASM_TYPE_VOID,
} from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { allocateLocal } from '../localStorage';

import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `ensureNonZero`.
 * @see [Instruction docs](../../docs/instructions/math-helpers.md)
 */
const ensureNonZero: InstructionCompiler = (line, context, facts) => {
	const [operand] = facts.stackAnalysis.consumedOperands;

	const isInteger = operand.valueType === 'int';
	const isFloat64 = operand.valueType === 'float64';
	let defaultNonZeroValue = 1;

	if (line.arguments[0] && line.arguments[0].type === ArgumentType.LITERAL) {
		defaultNonZeroValue = line.arguments[0].value;
	}

	const tempVariableName = '__ensureNonZero_temp_' + line.lineNumber;

	if (isInteger) {
		const tempLocal = allocateLocal(context, tempVariableName, {
			isInteger: true,
		});
		const tempLocalIndex = tempLocal.index;
		return saveByteCode(context, [
			...localSet(tempLocalIndex),
			...localGet(tempLocalIndex),
			WASM_I32_EQZ,
			WASM_IF,
			WASM_TYPE_I32,
			...i32const(defaultNonZeroValue),
			WASM_ELSE,
			...localGet(tempLocalIndex),
			WASM_END,
		]);
	} else {
		const tempLocal = allocateLocal(context, tempVariableName, {
			isInteger: false,
			...(isFloat64 ? { isFloat64: true } : {}),
		});
		const tempLocalIndex = tempLocal.index;
		const zeroByteCode = isFloat64 ? f64const(0) : f32const(0);
		const fallbackByteCode = isFloat64 ? f64const(defaultNonZeroValue) : f32const(defaultNonZeroValue);
		return saveByteCode(context, [
			...localSet(tempLocalIndex),
			...localGet(tempLocalIndex),
			...zeroByteCode,
			isFloat64 ? WASM_F64_EQ : WASM_F32_EQ,
			WASM_IF,
			WASM_TYPE_VOID,
			...fallbackByteCode,
			...localSet(tempLocalIndex),
			WASM_END,
			...localGet(tempLocalIndex),
		]);
	}
};

export default ensureNonZero;
