import createVector from '../encoding/createVector';
import unsignedLEB128 from '../encoding/unsignedLEB128';
import { Section } from '../section';

/**
 * Creates a WebAssembly function section that maps function indices to their type signatures.
 *
 * @param functionTypeIndexes - Array of type indices for each function
 * @returns Byte array representing the complete function section
 */
export default function createFunctionSection(functionTypeIndexes: number[]): number[] {
	const numberOfFunctions = functionTypeIndexes.length;

	return [
		Section.FUNCTION,
		...createVector([...unsignedLEB128(numberOfFunctions), ...functionTypeIndexes.flatMap(unsignedLEB128)]),
	];
}
