/**
 * Converts a JavaScript number to IEEE 754 single-precision (32-bit) floating-point format.
 * Returns bytes in little-endian format.
 *
 * @param n - The number to convert
 * @returns A Uint8Array containing the little-endian byte representation
 */
const ieee754 = (n: number): Uint8Array => {
	const buf = new ArrayBuffer(4);
	const view = new DataView(buf);
	view.setFloat32(0, n, true);
	return new Uint8Array(buf);
};

export default ieee754;
