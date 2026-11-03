/**
 * Splits the current line at the caret and moves the caret to the start of the next line.
 * @param code Document contents split by line.
 * @param row Caret row index.
 * @param col Caret column index.
 * @returns Updated document and caret location after inserting a newline.
 */
export default function insertNewLine(
	code: string[],
	row: number,
	col: number
): {
	code: string[];
	row: number;
	col: number;
} {
	const newCode = [...code];
	newCode.splice(row, 1, code[row].slice(0, col), code[row].slice(col));
	return { code: newCode, row: row + 1, col: 0 };
}
