/**
 * WebAssembly miscellaneous instruction sub-opcodes.
 */

/**
 * Non-trapping truncate f32 to signed i32.
 * Full instruction encoding: 0xfc 0x00
 * Type signature: (param f32) (result i32)
 */
export const WASM_MISC_I32_TRUNC_SAT_F32_S = 0x00;

/**
 * Non-trapping truncate f64 to signed i32.
 * Full instruction encoding: 0xfc 0x02
 * Type signature: (param f64) (result i32)
 */
export const WASM_MISC_I32_TRUNC_SAT_F64_S = 0x02;

/**
 * Bulk-memory copy from a passive data segment into linear memory.
 * Full instruction encoding: 0xfc 0x08 <dataidx> <memidx>
 * Stack: destination memory offset, source data offset, byte count.
 */
export const WASM_MISC_MEMORY_INIT = 0x08;

/**
 * Bulk-memory copy within linear memory.
 * Full instruction encoding: 0xfc 0x0a <dstmemidx> <srcmemidx>
 * Stack: destination memory offset, source memory offset, byte count.
 */
export const WASM_MISC_MEMORY_COPY = 0x0a;

/**
 * Bulk-memory fill of linear memory with a byte value.
 * Full instruction encoding: 0xfc 0x0b <memidx>
 * Stack: destination memory offset, fill byte value, byte count.
 */
export const WASM_MISC_MEMORY_FILL = 0x0b;

/**
 * Numeric sub-opcode for a miscellaneous WebAssembly instruction following the 0xfc prefix.
 */
export type WASMMiscInstructionCode =
	| typeof WASM_MISC_I32_TRUNC_SAT_F32_S
	| typeof WASM_MISC_I32_TRUNC_SAT_F64_S
	| typeof WASM_MISC_MEMORY_INIT
	| typeof WASM_MISC_MEMORY_COPY
	| typeof WASM_MISC_MEMORY_FILL;
