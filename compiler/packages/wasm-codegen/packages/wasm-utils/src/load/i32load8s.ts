import memarg from '../memory/memarg';
import { WASM_I32_LOAD_8_S } from '../wasmInstruction';

/**
 * Creates a WebAssembly i32.load8_s instruction to load a signed 8-bit integer from memory.
 *
 * @param alignment - Memory alignment (power of 2), defaults to 0 (1-byte aligned)
 * @param offset - Static offset from the address, defaults to 0
 * @returns Byte array representing the i32.load8_s instruction
 */
export default function i32load8s(alignment = 0, offset = 0): number[] {
	return [WASM_I32_LOAD_8_S, ...memarg(alignment, offset)];
}
