import unsignedLEB128 from './unsignedLEB128';

/**
 * Creates a WebAssembly prefixed instruction.
 *
 * @param prefix - Prefix opcode byte
 * @param instruction - Numeric sub-opcode encoded after the prefix
 * @returns Byte array representing the prefixed instruction
 */
export default function prefixedInstruction(prefix: number, instruction: number): number[] {
	return [prefix, ...unsignedLEB128(instruction)];
}
