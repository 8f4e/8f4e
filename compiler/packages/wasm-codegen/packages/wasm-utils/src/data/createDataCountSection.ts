import createVector from '../encoding/createVector';
import unsignedLEB128 from '../encoding/unsignedLEB128';
import { Section } from '../section';

/**
 * Creates a WebAssembly data count section.
 *
 * The data count section is required when code uses bulk-memory instructions that
 * reference data segment indices.
 *
 * @param dataSegmentCount - Number of data segments to encode.
 * @returns Created data count section.
 */
export default function createDataCountSection(dataSegmentCount: number): number[] {
	return [Section.DATA_COUNT, ...createVector(unsignedLEB128(dataSegmentCount))];
}
