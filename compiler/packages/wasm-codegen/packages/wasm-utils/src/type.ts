/**
 * WebAssembly value type codes.
 */

export const WASM_TYPE_VOID = 0x40;

/**
 * WebAssembly value type code for i32.
 */
export const WASM_TYPE_I32 = 0x7f;

/**
 * WebAssembly value type code for f64.
 */
export const WASM_TYPE_F64 = 0x7c;

/**
 * WebAssembly value type code for f32.
 */
export const WASM_TYPE_F32 = 0x7d;

/**
 * WebAssembly block or value type code accepted by this package.
 */
export type WasmTypeValue = typeof WASM_TYPE_VOID | typeof WASM_TYPE_I32 | typeof WASM_TYPE_F64 | typeof WASM_TYPE_F32;
