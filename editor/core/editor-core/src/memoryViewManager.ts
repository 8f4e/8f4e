import type { MemoryViews } from '@8f4e/web-ui';

export type MemoryRef = WebAssembly.Memory | ArrayBuffer | SharedArrayBuffer;

/**
 * Creates memory views and keeps them updated when the underlying buffer identity changes.
 */
export function createMemoryViewManager(memoryRef: MemoryRef): {
	memoryViews: MemoryViews;
	updateMemoryViews: (memoryRef: MemoryRef) => void;
} {
	let cachedBuffer: ArrayBuffer | SharedArrayBuffer | null = null;
	const memoryViews: MemoryViews = {
		int8: new Int8Array(0),
		int16: new Int16Array(0),
		int32: new Int32Array(0),
		uint8: new Uint8Array(0),
		uint16: new Uint16Array(0),
		float32: new Float32Array(0),
		float64: new Float64Array(0),
	};

	const updateMemoryViews = (memoryRef: MemoryRef) => {
		let buffer: ArrayBuffer | SharedArrayBuffer;

		if (memoryRef instanceof WebAssembly.Memory) {
			buffer = memoryRef.buffer;
		} else if (memoryRef instanceof ArrayBuffer || memoryRef instanceof SharedArrayBuffer) {
			buffer = memoryRef;
		} else {
			buffer = new ArrayBuffer(0);
		}

		if (buffer !== cachedBuffer) {
			cachedBuffer = buffer;
			memoryViews.int8 = new Int8Array(buffer);
			memoryViews.int16 = new Int16Array(buffer);
			memoryViews.int32 = new Int32Array(buffer);
			memoryViews.uint8 = new Uint8Array(buffer);
			memoryViews.uint16 = new Uint16Array(buffer);
			memoryViews.float32 = new Float32Array(buffer);
			memoryViews.float64 = new Float64Array(buffer);
		}
	};

	updateMemoryViews(memoryRef);

	return {
		memoryViews,
		updateMemoryViews,
	};
}
