import type { Position, Viewport } from '@8f4e/editor-state-types';
import type { CodeBlockBounds } from './centerViewportOnCodeBlock';
import roundToGrid from './roundToGrid';

export interface CodeBlockCursorBounds extends CodeBlockBounds {
	cursor: {
		y: number;
	};
}

/**
 * Centers the viewport horizontally on a code block and vertically on its highlighted line.
 */
export default function centerViewportOnCodeBlockCursor<T extends CodeBlockCursorBounds>(
	viewport: Viewport,
	codeBlock: T
): Position {
	const blockCenterX = codeBlock.x + codeBlock.width / 2;
	const highlightedLineY = codeBlock.y + codeBlock.cursor.y;
	const [x, y] = roundToGrid(blockCenterX - viewport.width / 2, highlightedLineY - viewport.height / 2, viewport);

	return {
		x,
		y,
	};
}
