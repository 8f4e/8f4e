const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;

/** Byte offsets shared by the line-instance writer and GPU attribute bindings. */
export const LINE_INSTANCE_LAYOUT = {
	x1: 0,
	y1: FLOAT_BYTES,
	x2: 2 * FLOAT_BYTES,
	y2: 3 * FLOAT_BYTES,
	thickness: 4 * FLOAT_BYTES,
	color: 5 * FLOAT_BYTES,
} as const;

export const LINE_INSTANCE_BYTE_STRIDE = LINE_INSTANCE_LAYOUT.color + 4;

/** Normalized red, green, blue, and alpha components for one line. */
export type LineColor = readonly [red: number, green: number, blue: number, alpha: number];
