import createVector from '../encoding/createVector';

/**
 * Creates a passive WebAssembly data segment payload.
 *
 * Passive segments are addressed by bulk-memory instructions such as memory.init
 * and are not copied into linear memory automatically by the WebAssembly runtime.
 *
 * @param bytes - Raw bytes to encode.
 * @returns Created passive data segment.
 */
export default function createPassiveDataSegment(bytes: ArrayLike<number>): number[] {
	return [0x01, ...createVector(Array.from(bytes))];
}
