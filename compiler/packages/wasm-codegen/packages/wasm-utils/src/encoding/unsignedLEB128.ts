/**
 * Encodes an unsigned integer using LEB128 (Little Endian Base 128) variable-length encoding.
 *
 * LEB128 is a variable-length code compression format used by WebAssembly for encoding all integer literals.
 * Each byte encodes 7 bits of the integer with a continuation bit in the MSB.
 *
 * @param n - The unsigned integer to encode
 * @returns An array of bytes representing the LEB128-encoded value
 */
export default function unsignedLEB128(n: number): number[] {
	const buffer: number[] = [];
	do {
		let byte = n & 0b1111111;
		n >>>= 7;
		if (n !== 0) {
			byte |= 0b10000000;
		}
		buffer.push(byte);
	} while (n !== 0);
	return buffer;
}
