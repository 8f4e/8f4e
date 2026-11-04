import type { CanvasDrawer } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';

const EDIT_MODE_HINT = "You're in edit mode, press ESC to enter view mode";
const VIEW_MODE_HINT = "You're in view mode, press e to edit";

const drawModeHint: CanvasDrawer = ({ draw, state }) => {
	const modeHint = state.editorMode === 'edit' ? EDIT_MODE_HINT : VIEW_MODE_HINT;

	draw.startGroup(0, 0);
	draw.drawFill(0, 0, PALETTE_INDICES.surfaceBase, (modeHint.length + 2) * state.viewport.vGrid, state.viewport.hGrid);
	draw.drawText(state.viewport.vGrid, 0, modeHint, PALETTE_INDICES.mutedBase);
	draw.endGroup();
};

export default drawModeHint;
