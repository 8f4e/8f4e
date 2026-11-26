import unsignedLEB128 from '../encoding/unsignedLEB128';
import { WASM_BR } from '../wasmInstruction';

/**
 * Creates a WebAssembly br (branch) instruction for unconditional branching.
 *
 * @param breakDepth - The depth of the label to branch to (0 = current block)
 * @returns Byte array representing the br instruction
 */
export default function br(breakDepth: number): number[] {
	return [WASM_BR, ...unsignedLEB128(breakDepth)];
}
