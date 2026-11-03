import { getRawIndexForVisualColumn, getTabStopsByLine, getVisualColumnForRawIndex } from '@8f4e/editor-state';
import type { Direction } from '@8f4e/editor-state-types';

export function moveCaret(code: string[], row: number, col: number, direction: Direction): [number, number] {
	if (direction === 'left') return [row, Math.max(col - 1, 0)];
	if (direction === 'right') return [row, Math.min(col + 1, code[row].length)];
	const tabStops = getTabStopsByLine(code);
	const visualCol = getVisualColumnForRawIndex(code[row], col, tabStops[row]);
	const nextRow = Math.max(0, Math.min(row + (direction === 'up' ? -1 : 1), code.length - 1));
	return [nextRow, getRawIndexForVisualColumn(code[nextRow], visualCol, tabStops[nextRow])];
}
