/** Bound a source position to the available lines and columns. */
export function clampSourcePosition(code: readonly string[], row: number, col: number): [number, number] {
	const boundedRow = Math.min(Math.max(row, 0), code.length - 1);
	const boundedCol = Math.max(Math.min(col, code[boundedRow].length), 0);
	return [boundedRow, boundedCol];
}
