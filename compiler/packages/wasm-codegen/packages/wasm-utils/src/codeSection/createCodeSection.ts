import createVector from '../encoding/createVector';
import unsignedLEB128 from '../encoding/unsignedLEB128';
import type { FunctionBody } from '../section';
import { Section } from '../section';

/**
 * Creates a WebAssembly code section containing function bodies.
 *
 * @param functionBodies - Array of function bodies to include
 * @returns Byte array representing the complete code section
 */
export default function createCodeSection(functionBodies: FunctionBody[]): number[] {
	const numberOfFunctions = functionBodies.length;
	return [Section.CODE, ...createVector([...unsignedLEB128(numberOfFunctions), ...functionBodies.flat()])];
}
