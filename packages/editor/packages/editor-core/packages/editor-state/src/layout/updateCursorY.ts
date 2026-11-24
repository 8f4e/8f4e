import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import gapCalculator from './text-geometry/displayRowToGridRow';

/** Maps the current source row through the block's settled folds and contributed display gaps. */
export function updateCursorY(block: CodeBlockGraphicData, hGrid: number): void {
	const displayRow = block.displayModel.sourceLineIndexToDisplayRow[block.cursor.row] ?? block.cursor.row;
	block.cursor.y = gapCalculator(displayRow, block.gaps) * hGrid;
}
