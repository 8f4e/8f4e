import f32const from '../const/f32const';
import i32const from '../const/i32const';
import memarg from '../memory/memarg';
import { WASM_F32_STORE } from '../wasmInstruction';

/**
 * Creates a WebAssembly f32.store instruction to store a 32-bit float to memory.
 *
 * @param address - Optional address to store at (generates i32.const if provided)
 * @param value - Optional value to store (generates f32.const if provided)
 * @param alignment - Memory alignment (power of 2), defaults to 2 (4-byte aligned)
 * @param offset - Static offset from the address, defaults to 0
 * @returns Byte array representing the f32.store instruction and optional setup
 */
export default function f32store(address?: number, value?: number, alignment = 2, offset = 0): number[] {
	return [
		...(typeof address === 'undefined' ? [] : i32const(address)),
		...(typeof value === 'undefined' ? [] : f32const(value)),
		WASM_F32_STORE,
		...memarg(alignment, offset),
	];
}
