import encodeString from '../encoding/encodeString';
import unsignedLEB128 from '../encoding/unsignedLEB128';
import type { Import } from '../section';
import { ImportDesc } from '../section';

/**
 * Creates a function import entry for a host-provided WebAssembly function.
 *
 * @param moduleName - The module to import from.
 * @param fieldName - The field name to import.
 * @param typeIndex - The type-section index of the imported function signature.
 * @returns Byte array representing the function import entry.
 */
export default function createFunctionImport(moduleName: string, fieldName: string, typeIndex: number): Import {
	return [...encodeString(moduleName), ...encodeString(fieldName), ImportDesc.FUNC, ...unsignedLEB128(typeIndex)];
}
