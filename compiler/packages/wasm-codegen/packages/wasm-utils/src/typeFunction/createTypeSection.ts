import createVector from '../encoding/createVector';
import unsignedLEB128 from '../encoding/unsignedLEB128';
import type { FunctionType } from '../section';
import { Section } from '../section';

/**
 * Creates a WebAssembly type section containing function type signatures.
 *
 * @param types - Array of function types to include in the section
 * @returns Byte array representing the complete type section
 */
export default function createTypeSection(types: FunctionType[]): number[] {
	const numberOfTypes = types.length;
	return [Section.TYPE, ...createVector([...unsignedLEB128(numberOfTypes), ...types.flat()])];
}
