import unsignedLEB128 from '../encoding/unsignedLEB128';
import { WASM_LOCAL_SET } from '../wasmInstruction';

/**
 * Creates a WebAssembly local.set instruction to store the top stack value into a local variable.
 *
 * @param index - The index of the local variable
 * @returns Byte array representing the local.set instruction
 */
export default function localSet(index: number): number[] {
	return [WASM_LOCAL_SET, ...unsignedLEB128(index)];
}
