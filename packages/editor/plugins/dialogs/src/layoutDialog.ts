import { wrapText } from '@8f4e/editor-state';
import type { DialogContent, Viewport } from '@8f4e/editor-state-types';
import layoutButtons from './layoutButtons';
import type { DialogLayout } from './types';

const DIALOG_MIN_WIDTH_GRID_CELLS = 64;
const DIALOG_MAX_WIDTH_GRID_CELLS = 96;
const DIALOG_VERTICAL_GRID_CELLS_WITHOUT_TEXT = 5;

export default function layoutDialog(dialog: DialogContent, viewport: Viewport): DialogLayout {
	const { vGrid, hGrid } = viewport;
	const preferredWidth = Math.min(
		Math.max(viewport.width * 0.5, DIALOG_MIN_WIDTH_GRID_CELLS * vGrid),
		DIALOG_MAX_WIDTH_GRID_CELLS * vGrid
	);
	const availableWidth = viewport.width - 2 * vGrid;
	const width = Math.max(vGrid, Math.floor(Math.min(preferredWidth, availableWidth) / vGrid) * vGrid);
	const textWidth = Math.max(1, Math.floor(width / vGrid) - 2);
	const wrappedText = wrapText(dialog.text, textWidth);
	const buttonLayout = layoutButtons(dialog.buttons, width, wrappedText.length, vGrid, hGrid);
	const height = (wrappedText.length + buttonLayout.heightInGridRows + DIALOG_VERTICAL_GRID_CELLS_WITHOUT_TEXT) * hGrid;
	return {
		...dialog,
		title: dialog.title.slice(0, textWidth),
		wrappedText,
		buttons: buttonLayout.buttons,
		highlightedButton: Infinity,
		width,
		height,
		x: Math.round((viewport.width - width) / 2 / vGrid) * vGrid,
		y: Math.round((viewport.height - height) / 2 / hGrid) * hGrid,
	};
}
