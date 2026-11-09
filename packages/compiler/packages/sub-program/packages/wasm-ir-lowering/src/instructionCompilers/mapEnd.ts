import type { WASMInstructionCode } from '@8f4e/compiler-wasm-utils';
import {
	f32const,
	f64const,
	i32const,
	WASM_DROP,
	WASM_F32_EQ,
	WASM_F64_EQ,
	WASM_I32_EQ,
	WASM_SELECT,
} from '@8f4e/compiler-wasm-utils';
import type {
	InstructionCompiler,
	MapBlockStackFrame,
	MapEndLine,
	StackAnalysisNumericValueKind,
} from '@8f4e/language-spec';
import { wasmLocalGet as localGet, wasmLocalSet as localSet } from '@8f4e/language-spec';
import { popBlock } from '@8f4e/semantic-utils';
import { allocateLocal } from '../localStorage';
import { saveByteCode } from './utils/saveByteCode';

const constOp: Record<StackAnalysisNumericValueKind, (v: number) => number[]> = {
	int32: i32const,
	float32: f32const,
	float64: f64const,
};

const eqOpcode: Record<StackAnalysisNumericValueKind, WASMInstructionCode> = {
	int32: WASM_I32_EQ,
	float32: WASM_F32_EQ,
	float64: WASM_F64_EQ,
};

/**
 * Instruction compiler for `mapEnd`.
 * Closes a map block and emits branchless WebAssembly `select`-based lowering for
 * all collected mapping rows. Consumes the input value from the stack and pushes
 * the mapped result.
 *
 * Lowering algorithm (first-match-wins, branchless):
 * 1. Pop input into `inputLocal`.
 * 2. Initialise `resultLocal` to explicit default or typed zero.
 * 3. Visit rows in reverse source order:
 *    - resultLocal = select(value, resultLocal, inputLocal == key)
 *    Earlier source rows overwrite later matches, preserving first-match precedence.
 * 4. Push `resultLocal`.
 *
 * @see [Instruction docs](../../docs/instructions/control-flow.md)
 */
const mapEnd: InstructionCompiler<MapEndLine> = (_line, context, facts) => {
	const { inputKind, outputKind } = facts.map!;
	const outputIsInteger = outputKind === 'int32';
	const outputIsFloat64 = outputKind === 'float64';

	const { mapState } = popBlock(context) as MapBlockStackFrame;

	const rows = mapState.rows;
	const hasDefault = mapState.defaultSet;
	const defaultValue = hasDefault ? mapState.defaultValue! : 0;

	const inputIsFloat64 = inputKind === 'float64';
	const inputIsInteger = inputKind === 'int32';

	if (rows.length === 0) {
		// No rows: discard the input and push the default/zero value
		saveByteCode(context, [WASM_DROP, ...constOp[outputKind](defaultValue)]);
	} else {
		// Allocate only the input and accumulated result.
		const inputLocalIdx = allocateLocal(context, {
			isInteger: inputIsInteger,
			...(inputIsFloat64 ? { isFloat64: true } : {}),
		});
		const resultLocalIdx = allocateLocal(context, {
			isInteger: outputIsInteger,
			...(outputIsFloat64 ? { isFloat64: true } : {}),
		});

		// Save the input and initialize the result to the default.
		saveByteCode(context, [
			...localSet(inputLocalIdx),
			...constOp[outputKind](defaultValue),
			...localSet(resultLocalIdx),
		]);

		// Earlier source rows execute last and win, without mutating the source rows.
		for (let index = rows.length - 1; index >= 0; index--) {
			const row = rows[index];
			saveByteCode(context, [
				// Push the candidate value for this row
				...constOp[outputKind](row.valueValue),
				// Push current resultLocal
				...localGet(resultLocalIdx),
				// Compare the input with this row's key.
				...localGet(inputLocalIdx),
				...constOp[inputKind](row.keyValue),
				eqOpcode[inputKind],
				// select(value, resultLocal, inputLocal == key)
				WASM_SELECT,
				// Update resultLocal
				...localSet(resultLocalIdx),
			]);
		}

		// Push the final result.
		saveByteCode(context, localGet(resultLocalIdx));
	}

	return context;
};

export default mapEnd;
