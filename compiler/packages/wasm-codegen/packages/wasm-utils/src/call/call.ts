import unsignedLEB128 from '../encoding/unsignedLEB128';
import { WASM_CALL } from '../wasmInstruction';

/**
 * Creates a WebAssembly call instruction to invoke a function by index.
 *
 * @param functionIndex - The index of the function to call
 * @returns Byte array representing the call instruction
 */
export default function call(functionIndex: number): number[] {
	return [WASM_CALL, ...unsignedLEB128(functionIndex)];
}
