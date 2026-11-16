import type { Font } from '@8f4e/sprite-generator';

/** Payload of `fontChanged`, emitted after a different font atlas and its grid are installed. */
export interface FontChangedEvent {
	font: Font;
}

/**
 * Typed array views for reading memory as integers or floats.
 */
export interface MemoryViews {
	int8: Int8Array;
	int16: Int16Array;
	int32: Int32Array;
	uint8: Uint8Array;
	uint16: Uint16Array;
	float32: Float32Array;
	float64: Float64Array;
}
