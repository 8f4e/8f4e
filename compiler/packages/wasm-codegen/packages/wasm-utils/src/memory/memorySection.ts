import createVector from '../encoding/createVector';
import unsignedLEB128 from '../encoding/unsignedLEB128';
import { Section } from '../section';

/**
 * Creates a WebAssembly memory section defining linear memory size limits.
 *
 * @param pageSize - Initial memory size in 64KB pages
 * @param maxPageSize - Optional maximum memory size in 64KB pages
 * @returns Byte array representing the complete memory section
 */
export default function createMemorySection(pageSize: number, maxPageSize?: number): number[] {
	const numberOfMemoryEntries = 1;
	const flags = maxPageSize !== undefined ? 0x01 : 0x00;
	return [
		Section.MEMORY,
		...createVector([
			...unsignedLEB128(numberOfMemoryEntries),
			...unsignedLEB128(flags),
			...unsignedLEB128(pageSize),
			...(maxPageSize !== undefined ? unsignedLEB128(maxPageSize) : []),
		]),
	];
}
