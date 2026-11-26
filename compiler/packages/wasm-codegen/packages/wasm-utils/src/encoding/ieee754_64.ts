/**
 * Converts a JavaScript number to IEEE 754 double-precision (64-bit) floating-point format.
 * Returns bytes in little-endian format.
 *
 * @param n - The number to convert
 * @returns A Uint8Array containing the little-endian byte representation
 */
const ieee754_64 = (n: number): Uint8Array => {
	const buf = new ArrayBuffer(8);
	const view = new DataView(buf);
	view.setFloat64(0, n, true);
	return new Uint8Array(buf);
};

export default ieee754_64;
