import encodeString from '../encoding/encodeString';
import unsignedLEB128 from '../encoding/unsignedLEB128';
import type { Import } from '../section';
import { ImportDesc } from '../section';

/**
 * Creates a shared linear memory import with an explicit maximum from the host environment.
 *
 * @param moduleName - The module to import from (e.g., 'host')
 * @param fieldName - The field name to import (e.g., 'memory')
 * @param initial - Initial memory size in 64KB pages (defaults to 1)
 * @param max - Maximum memory size in pages (defaults to initial)
 * @returns Byte array representing the memory import entry
 */
export default function createMemoryImport(moduleName: string, fieldName: string, initial = 1, max = initial): Import {
	return [
		...encodeString(moduleName),
		...encodeString(fieldName),
		ImportDesc.MEMORY,
		0x03,
		...unsignedLEB128(initial),
		...unsignedLEB128(max),
	];
}
