import i32const from '../const/i32const';
import memarg from '../memory/memarg';
import { WASM_I32_STORE8 } from '../wasmInstruction';

/**
 * Creates a WebAssembly i32.store8 instruction to store the low byte of a 32-bit integer to memory.
 *
 * @param address - Optional address to store at (generates i32.const if provided)
 * @param value - Optional value to store (generates i32.const if provided)
 * @param alignment - Memory alignment (power of 2), defaults to 0 (byte-aligned)
 * @param offset - Static offset from the address, defaults to 0
 * @returns Byte array representing the i32.store8 instruction and optional setup
 */
export default function i32store8(address?: number, value?: number, alignment = 0, offset = 0): number[] {
	return [
		...(typeof address === 'undefined' ? [] : i32const(address)),
		...(typeof value === 'undefined' ? [] : i32const(value)),
		WASM_I32_STORE8,
		...memarg(alignment, offset),
	];
}
