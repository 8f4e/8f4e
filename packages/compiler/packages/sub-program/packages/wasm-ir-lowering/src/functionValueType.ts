import type { WasmTypeValue } from '@8f4e/compiler-wasm-utils';
import { WASM_TYPE_F32, WASM_TYPE_F64, WASM_TYPE_I32 } from '@8f4e/compiler-wasm-utils';
import type { FunctionValueType } from '@8f4e/language-spec';

/**
 * Maps a function signature value type to the binary WASM value type emitted for calls and exports.
 *
 * @param type - Function value type to convert.
 * @returns The matching WASM value type.
 */
export function functionValueTypeToWasmType(type: FunctionValueType): WasmTypeValue {
	if (type === 'float64') {
		return WASM_TYPE_F64;
	}

	if (type === 'float') {
		return WASM_TYPE_F32;
	}

	return WASM_TYPE_I32;
}
