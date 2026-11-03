import { moveCaret } from '@8f4e/editor-state';

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
	const save = newCode[row].substring(col);
	newCode[row] = newCode[row].substring(0, col);
	newCode.splice(row + 1, 0, '');
	newCode[row + 1] = save;

	const [newRow] = moveCaret(newCode, row, col, 'down');
	return { code: newCode, row: newRow, col: 0 };
}
