import createVector from '../encoding/createVector';
import unsignedLEB128 from '../encoding/unsignedLEB128';
import type { DataSegment } from '../section';
import { Section } from '../section';

/**
 * Creates a WebAssembly data section containing passive or active data segments.
 *
 * @param dataSegments - Data segments to encode.
 * @returns Created data section.
 */
export default function createDataSection(dataSegments: DataSegment[]): number[] {
	return [Section.DATA, ...createVector([...unsignedLEB128(dataSegments.length), ...dataSegments.flat()])];
}
