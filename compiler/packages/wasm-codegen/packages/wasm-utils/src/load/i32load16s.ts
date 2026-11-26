import memarg from '../memory/memarg';
import { WASM_I32_LOAD_16_S } from '../wasmInstruction';

/**
 * Creates a WebAssembly i32.load16_s instruction to load a signed 16-bit integer from memory.
 *
 * @param alignment - Memory alignment (power of 2), defaults to 1 (2-byte aligned)
 * @param offset - Static offset from the address, defaults to 0
 * @returns Byte array representing the i32.load16_s instruction
 */
export default function i32load16s(alignment = 1, offset = 0): number[] {
	return [WASM_I32_LOAD_16_S, ...memarg(alignment, offset)];
}
