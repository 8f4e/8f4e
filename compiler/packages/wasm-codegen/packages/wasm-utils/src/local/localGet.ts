import unsignedLEB128 from '../encoding/unsignedLEB128';
import { WASM_LOCAL_GET } from '../wasmInstruction';

/**
 * Creates a WebAssembly local.get instruction to retrieve a local variable onto the stack.
 *
 * @param index - The index of the local variable
 * @returns Byte array representing the local.get instruction
 */
export default function localGet(index: number): number[] {
	return [WASM_LOCAL_GET, ...unsignedLEB128(index)];
}
