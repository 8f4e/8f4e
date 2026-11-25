import type { MemoryViews } from '@8f4e/web-ui';

/**
 * Creates mock MemoryViews for screenshot tests.
 *
 * @param sizeInBytes Optional size of the memory buffer in bytes (default: 1MB)
 * @returns MemoryViews with initialized typed array views
 */
export default function createMockMemoryViews(sizeInBytes = 1048576): MemoryViews {
	const buffer = new ArrayBuffer(sizeInBytes);
	return {
		int8: new Int8Array(buffer),
		int16: new Int16Array(buffer),
		int32: new Int32Array(buffer),
		uint8: new Uint8Array(buffer),
		uint16: new Uint16Array(buffer),
		float32: new Float32Array(buffer),
		float64: new Float64Array(buffer),
	};
}
