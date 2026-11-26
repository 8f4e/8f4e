import unsignedLEB128 from './unsignedLEB128';

/**
 * Encodes a string as a WebAssembly vector: length prefix followed by UTF-8 bytes.
 *
 * @param str - The string to encode
 * @returns An array of bytes containing the length-prefixed string data
 */
export default function encodeString(str: string): number[] {
	return [...unsignedLEB128(str.length), ...str.split('').map(char => char.charCodeAt(0))];
}
