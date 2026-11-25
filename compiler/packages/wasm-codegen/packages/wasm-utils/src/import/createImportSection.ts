import createVector from '../encoding/createVector';
import unsignedLEB128 from '../encoding/unsignedLEB128';
import type { Import } from '../section';
import { Section } from '../section';

/**
 * Creates a WebAssembly import section containing import declarations.
 *
 * @param imports - Array of import entries
 * @returns Byte array representing the complete import section
 */
export default function createImportSection(imports: Import[]): number[] {
	const numImports = imports.length;
	return [Section.IMPORT, ...createVector([...unsignedLEB128(numImports), ...imports.flat()])];
}
