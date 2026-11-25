import encodeString from '../encoding/encodeString';
import unsignedLEB128 from '../encoding/unsignedLEB128';

import type { FunctionName } from '../section';

/**
 * Creates a function name entry for the name section.
 *
 * @param functionIndex - The index of the function
 * @param name - The debug name for the function
 * @returns Byte array representing the function name entry
 */
export default function createFunctionName(functionIndex: number, name: string): FunctionName {
	return [...unsignedLEB128(functionIndex), ...encodeString(name)];
}
