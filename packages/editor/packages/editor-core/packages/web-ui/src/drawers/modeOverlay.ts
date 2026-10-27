import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../drawContext';

const EDIT_MODE_HINT = "You're in edit mode, press ESC to enter view mode";
const VIEW_MODE_HINT = "You're in view mode, press e to edit";

export default function drawModeOverlay(engine: DrawContext, state: State): void {
	if (!state.featureFlags.modeOverlay || !state.featureFlags.modeToggling) {
		return;
	}

	const modeHint = state.editorMode === 'edit' ? EDIT_MODE_HINT : VIEW_MODE_HINT;

	engine.startGroup(0, 0);
	engine.drawFill(
		0,
		0,
		PALETTE_INDICES.surfaceBase,
		(modeHint.length + 2) * state.viewport.vGrid,
		state.viewport.hGrid
	);
	engine.drawText(state.viewport.vGrid, 0, modeHint, PALETTE_INDICES.mutedBase);
	engine.endGroup();
}
