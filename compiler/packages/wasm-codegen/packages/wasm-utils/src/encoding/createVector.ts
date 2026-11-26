import unsignedLEB128 from './unsignedLEB128';

/**
 * Creates a WebAssembly vector by prefixing data with its length.
 *
 * @param data - The data to encode as a vector
 * @returns An array of bytes containing the length-prefixed data
 */
export default function createVector(data: number[]): number[] {
	return [...unsignedLEB128(data.length), ...data];
}
