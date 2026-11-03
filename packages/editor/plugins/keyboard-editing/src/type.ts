import { moveCaret } from '@8f4e/editor-state';

/**
 * Inserts a character at the caret position and advances the caret by one column.
 * @param code Current program text split by line.
 * @param row Caret row index.
 * @param col Caret column index.
 * @param char Character to insert.
 * @returns Updated code buffer plus the new caret coordinates.
 */
export default function type(
	code: string[],
	row: number,
	col: number,
	char: string
): { code: string[]; row: number; col: number } {
	const newCode = [...code];
	newCode[row] = newCode[row].substring(0, col) + char + newCode[row].substring(col);
	const [newRow, newCol] = moveCaret(newCode, row, col, 'right');
	return {
		code: newCode,
		row: newRow,
		col: newCol,
	};
}
