/**
 * Deletes the character before the caret or merges lines when positioned at column zero.
 * @param code Current document represented as an array of lines.
 * @param row Caret row index.
 * @param col Caret column index within the row.
 * @returns Updated document and caret coordinates after the deletion attempt.
 */
export default function deleteBackward(
	code: string[],
	row: number,
	col: number
): { code: string[]; row: number; col: number } {
	const newCode = [...code];

	if (col > 0) {
		const newCol = col - 1;
		newCode[row] = newCode[row].slice(0, newCol) + newCode[row].slice(newCol + 1);
		return { code: newCode, row, col: newCol };
	}

	if (row > 0) {
		const save = newCode[row];
		const newRow = row - 1;
		newCode.splice(row, 1);
		const joinColumn = newCode[newRow].length;
		newCode[newRow] = newCode[newRow] + save;
		return { code: newCode, row: newRow, col: joinColumn };
	}

	return { code, row, col };
}
