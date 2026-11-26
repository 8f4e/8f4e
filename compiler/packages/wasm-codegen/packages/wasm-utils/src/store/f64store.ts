import f64const from '../const/f64const';
import i32const from '../const/i32const';
import memarg from '../memory/memarg';
import { WASM_F64_STORE } from '../wasmInstruction';

/**
 * Creates a WebAssembly f64.store instruction to store a 64-bit float to memory.
 *
 * @param address - Optional address to store at (generates i32.const if provided)
 * @param value - Optional value to store (generates f64.const if provided)
 * @param alignment - Memory alignment (power of 2), defaults to 3 (8-byte aligned)
 * @param offset - Static offset from the address, defaults to 0
 * @returns Byte array representing the f64.store instruction and optional setup
 */
export default function f64store(address?: number, value?: number, alignment = 3, offset = 0): number[] {
	return [
		...(typeof address === 'undefined' ? [] : i32const(address)),
		...(typeof value === 'undefined' ? [] : f64const(value)),
		WASM_F64_STORE,
		...memarg(alignment, offset),
	];
}
