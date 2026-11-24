import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import displayRowToGridRow from './text-geometry/displayRowToGridRow';

/** Maps the current source row through the block's settled folds and contributed display gaps. */
export function updateCursorY(block: EditorCodeBlock, hGrid: number): void {
	const displayRow = block.displayModel.sourceLineIndexToDisplayRow[block.cursor.row] ?? block.cursor.row;
	block.cursor.y = displayRowToGridRow(displayRow, block.gaps) * hGrid;
}
