/**
 * Encodes a signed integer using LEB128 (Little Endian Base 128) variable-length encoding.
 *
 * LEB128 is a variable-length code compression format used by WebAssembly for encoding signed integers.
 * Each byte encodes 7 bits of the integer with a continuation bit in the MSB.
 *
 * @param n - The signed integer to encode
 * @returns An array of bytes representing the LEB128-encoded value
 */
export default function signedLEB128(n: number): number[] {
	const buffer: number[] = [];
	let more = true;
	const isNegative = n < 0;
	const bitCount = Math.ceil(Math.log2(Math.abs(n))) + 1;
	while (more) {
		let byte = n & 0b1111111;
		n >>= 7;
		if (isNegative) {
			n = n | -(0b1 << (bitCount - 8));
		}
		if ((n === 0 && (byte & 0b1000000) === 0) || (n === -1 && (byte & 0b1000000) === 0b1000000)) {
			more = false;
		} else {
			byte |= 0b10000000;
		}
		buffer.push(byte);
	}
	return buffer;
}
