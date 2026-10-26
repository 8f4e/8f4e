/** Copies one fixed-cell bitmap glyph into an R8 coverage array. */
export function writeGlyph(
	data: Uint8Array,
	stride: number,
	font: readonly number[],
	code: number,
	width: number,
	height: number,
	x: number,
	y: number
): void {
	for (let row = 0; row < height; row++) {
		const bits = font[code * height + row];
		for (let column = 0; column < width; column++) {
			if ((bits & (1 << (width - 1 - column))) !== 0) data[(y + row) * stride + x + column] = 255;
		}
	}
}
