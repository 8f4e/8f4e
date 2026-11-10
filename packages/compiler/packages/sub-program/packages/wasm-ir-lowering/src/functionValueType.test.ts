import { WASM_TYPE_F32, WASM_TYPE_F64, WASM_TYPE_I32 } from '@8f4e/compiler-wasm-utils';
import type { FunctionValueType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { functionValueTypeToWasmType } from './functionValueType';

describe('function value type WASM helpers', () => {
	it.each([
		['int', WASM_TYPE_I32],
		['int*', WASM_TYPE_I32],
		['int8u*', WASM_TYPE_I32],
		['float', WASM_TYPE_F32],
		['float64', WASM_TYPE_F64],
	])('converts %s to a wasm type', (type, expected) => {
		expect(functionValueTypeToWasmType(type as FunctionValueType)).toBe(expected);
	});
});
