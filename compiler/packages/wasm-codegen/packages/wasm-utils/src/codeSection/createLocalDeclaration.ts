import unsignedLEB128 from '../encoding/unsignedLEB128';
import type { LocalDeclaration } from '../section';
import type { WasmTypeValue } from '../type';

/**
 * Creates a local variable declaration for a WebAssembly function.
 *
 * @param type - The type of the local variable
 * @param typeCount - Number of consecutive locals of this type (defaults to 1)
 * @returns Byte array representing the local declaration
 */
export default function createLocalDeclaration(type: WasmTypeValue, typeCount = 1): LocalDeclaration {
	return [...unsignedLEB128(typeCount), type];
}
