import i32const from '../const/i32const';
import memarg from '../memory/memarg';
import { WASM_I32_STORE16 } from '../wasmInstruction';

/**
 * Creates a WebAssembly i32.store16 instruction to store the low 16 bits of a 32-bit integer to memory.
 *
 * @param address - Optional address to store at (generates i32.const if provided)
 * @param value - Optional value to store (generates i32.const if provided)
 * @param alignment - Log2 of the memory alignment in bytes (defaults to 1, meaning 2^1 = 2-byte alignment)
 * @param offset - Static offset from the address, defaults to 0
 * @returns Byte array representing the i32.store16 instruction and optional setup
 */
export default function i32store16(address?: number, value?: number, alignment = 1, offset = 0): number[] {
	return [
		...(typeof address === 'undefined' ? [] : i32const(address)),
		...(typeof value === 'undefined' ? [] : i32const(value)),
		WASM_I32_STORE16,
		...memarg(alignment, offset),
	];
}
