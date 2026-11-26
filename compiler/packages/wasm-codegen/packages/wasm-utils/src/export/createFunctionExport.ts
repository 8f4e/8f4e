import encodeString from '../encoding/encodeString';
import unsignedLEB128 from '../encoding/unsignedLEB128';
import type { FunctionExport } from '../section';
import { ExportDesc } from '../section';

/**
 * Creates a function export entry that makes a function accessible from outside the module.
 *
 * @param name - The export name
 * @param reference - The function index to export
 * @returns Byte array representing the function export entry
 */
export default function createFunctionExport(name: string, reference: number): FunctionExport {
	return [...encodeString(name), ExportDesc.FUNC, ...unsignedLEB128(reference)];
}
