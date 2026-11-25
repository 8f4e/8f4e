import signedLEB128 from '../encoding/signedLEB128';
import { WASM_I32_CONST } from '../wasmInstruction';

/**
 * Creates a WebAssembly i32.const instruction to push a signed 32-bit integer constant onto the stack.
 *
 * @param number - The signed integer value
 * @returns Byte array representing the i32.const instruction
 */
export default function i32const(number: number): number[] {
	return [WASM_I32_CONST, ...signedLEB128(number)];
}
