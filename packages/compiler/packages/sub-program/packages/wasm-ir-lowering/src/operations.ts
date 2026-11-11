import {
	WASM_BR,
	WASM_BR_IF,
	WASM_ELSE,
	WASM_END,
	WASM_F32_LOAD,
	WASM_F32_STORE,
	WASM_F64_LOAD,
	WASM_F64_STORE,
	WASM_I32_LOAD,
	WASM_I32_LOAD_8_S,
	WASM_I32_LOAD_8_U,
	WASM_I32_LOAD_16_S,
	WASM_I32_LOAD_16_U,
	WASM_I32_STORE,
	WASM_I32_STORE8,
	WASM_I32_STORE16,
	WASM_IF,
	WASM_TYPE_VOID,
	type WasmTypeValue,
} from '@8f4e/compiler-wasm-utils';
import type { WasmIRInstruction } from '@8f4e/language-spec';

export const i32const = (value: number): WasmIRInstruction[] => [{ kind: 'i32.const', value }];
export const f32const = (value: number): WasmIRInstruction[] => [{ kind: 'f32.const', value }];
export const f64const = (value: number): WasmIRInstruction[] => [{ kind: 'f64.const', value }];
export const br = (depth: number): WasmIRInstruction[] => [{ kind: 'branch', opcode: WASM_BR, depth }];
export const br_if = (depth: number): WasmIRInstruction[] => [{ kind: 'branch', opcode: WASM_BR_IF, depth }];

export function prefixedInstruction(prefix: number, opcode: number): WasmIRInstruction[] {
	return [{ kind: 'prefixed', prefix, opcode }];
}

export function ifelse(
	result: WasmTypeValue,
	then: readonly WasmIRInstruction[],
	otherwise: readonly WasmIRInstruction[] = []
): WasmIRInstruction[] {
	return [
		{ kind: 'block', opcode: WASM_IF, results: result === WASM_TYPE_VOID ? [] : [result] },
		...then,
		WASM_ELSE,
		...otherwise,
		WASM_END,
	];
}

export const memoryCopy = (): WasmIRInstruction[] => [{ kind: 'memory.copy' }];

function memoryAccess(opcode: number, defaultAlignment: number) {
	return (alignment = defaultAlignment, offset = 0): WasmIRInstruction[] => [
		{ kind: 'memoryAccess', opcode, alignment, offset },
	];
}

export const i32load = memoryAccess(WASM_I32_LOAD, 2);
export const i32load8s = memoryAccess(WASM_I32_LOAD_8_S, 0);
export const i32load8u = memoryAccess(WASM_I32_LOAD_8_U, 0);
export const i32load16s = memoryAccess(WASM_I32_LOAD_16_S, 1);
export const i32load16u = memoryAccess(WASM_I32_LOAD_16_U, 1);
export const f32load = memoryAccess(WASM_F32_LOAD, 2);
export const f64load = memoryAccess(WASM_F64_LOAD, 3);
export const i32store = memoryAccess(WASM_I32_STORE, 2);
export const i32store8 = memoryAccess(WASM_I32_STORE8, 0);
export const i32store16 = memoryAccess(WASM_I32_STORE16, 1);
export const f32store = memoryAccess(WASM_F32_STORE, 2);
export const f64store = memoryAccess(WASM_F64_STORE, 3);
