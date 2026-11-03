import type { Direction } from '@8f4e/editor-state-types';

export type MoveDirection = Direction | 'jump';

/**
 * Calculates a new caret position after moving in the requested direction while clamping to document bounds.
 * @param code Document contents as an array of lines.
 * @param row Current caret row index.
 * @param col Current caret column index.
 * @param direction Movement direction requested by the user.
 * @returns Tuple containing the resulting row and column.
 */
export function moveCaret(code: string[], row: number, col: number, direction: MoveDirection): [number, number] {
	switch (direction) {
		case 'up': {
			const nextRow = Math.max(row - 1, 0);
			const nextCol = code[nextRow][col] ? col : code[nextRow].length;
			return [nextRow, nextCol];
		}
		case 'down': {
			const nextRow = Math.min(row + 1, code.length - 1);
			const nextCol = code[nextRow][col] ? col : code[nextRow].length;
			return [nextRow, nextCol];
		}
		case 'left': {
			const nextCol = Math.max(col - 1, 0);
			return [row, nextCol];
		}
		case 'right': {
			const nextCol = Math.min(col + 1, code[row].length);
			return [row, nextCol];
		}
		case 'jump': {
			const boundedRow = Math.min(Math.max(row, 0), code.length - 1);
			const boundedCol = Math.max(Math.min(col, code[boundedRow].length), 0);
			return [boundedRow, boundedCol];
		}
	}
}
