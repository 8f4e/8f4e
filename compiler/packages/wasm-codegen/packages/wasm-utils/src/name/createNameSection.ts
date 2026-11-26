import createVector from '../encoding/createVector';
import encodeString from '../encoding/encodeString';
import unsignedLEB128 from '../encoding/unsignedLEB128';
import type { FunctionName } from '../section';
import { NameSection, Section } from '../section';

/**
 * Creates a WebAssembly name section for debugging information.
 *
 * @param functionNames - Array of function name entries
 * @returns Byte array representing the complete custom name section
 */
export default function createNameSection(functionNames: FunctionName[]): number[] {
	const numFunctions = functionNames.length;
	return [
		Section.CUSTOM,
		...createVector([
			...encodeString('name'),
			NameSection.FUNCTION_NAME,
			...createVector([...unsignedLEB128(numFunctions), ...functionNames.flat()]),
		]),
	];
}
