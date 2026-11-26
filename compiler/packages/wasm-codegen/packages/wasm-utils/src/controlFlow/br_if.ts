import unsignedLEB128 from '../encoding/unsignedLEB128';
import { WASM_BR_IF } from '../wasmInstruction';

/**
 * Creates a WebAssembly br_if (conditional branch) instruction.
 *
 * @param breakDepth - The depth of the label to branch to (0 = current block)
 * @returns Byte array representing the br_if instruction
 */
export default function br_if(breakDepth: number): number[] {
	return [WASM_BR_IF, ...unsignedLEB128(breakDepth)];
}
