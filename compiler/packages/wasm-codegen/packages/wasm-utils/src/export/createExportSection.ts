import createVector from '../encoding/createVector';
import unsignedLEB128 from '../encoding/unsignedLEB128';
import type { FunctionExport } from '../section';
import { Section } from '../section';

/**
 * Creates a WebAssembly export section containing function exports.
 *
 * @param _exports - Array of function exports
 * @returns Byte array representing the complete export section
 */
export default function createExportSection(_exports: FunctionExport[]): number[] {
	const numberOfExports = _exports.length;
	return [Section.EXPORT, ...createVector([...unsignedLEB128(numberOfExports), ..._exports.flat()])];
}
