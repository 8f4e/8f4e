import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../drawContext';

const DIALOG_CORNER = '+';
const BUTTON_HORIZONTAL_PADDING_GRID_CELLS = 4;
const BUTTON_VERTICAL_PADDING_GRID_CELLS = 1;

export default function drawDialog(engine: DrawContext, state: State): void {
	if (state.dialogStack.length === 0) {
		return;
	}

	engine.startGroup(0, 0);
	engine.drawFill(0, 0, PALETTE_INDICES.scrim, state.viewport.width, state.viewport.height);
	engine.endGroup();

	engine.startGroup(state.dialog.x, state.dialog.y);

	engine.drawFill(0, 0, PALETTE_INDICES.floatingSurface, state.dialog.width, state.dialog.height);

	engine.drawText(0, 0, DIALOG_CORNER, PALETTE_INDICES.floatingInk);
	engine.drawText(state.dialog.width - state.viewport.vGrid, 0, DIALOG_CORNER, PALETTE_INDICES.floatingInk);
	engine.drawText(0, state.dialog.height - state.viewport.hGrid, DIALOG_CORNER, PALETTE_INDICES.floatingInk);
	engine.drawText(
		state.dialog.width - state.viewport.vGrid,
		state.dialog.height - state.viewport.hGrid,
		DIALOG_CORNER,
		PALETTE_INDICES.floatingInk
	);

	engine.drawText(state.viewport.vGrid, state.viewport.hGrid, state.dialog.title, PALETTE_INDICES.floatingAccent);

	for (let i = 0; i < state.dialog.wrappedText.length; i++) {
		const textY = state.viewport.hGrid * (3 + i);
		engine.drawText(state.viewport.vGrid, textY, state.dialog.wrappedText[i], PALETTE_INDICES.floatingInk);
	}

	for (let i = 0; i < state.dialog.buttons.length; i++) {
		const button = state.dialog.buttons[i];
		engine.drawFill(button.x, button.y, PALETTE_INDICES.selectionSurface, button.width, button.height);
		engine.drawText(
			button.x + BUTTON_HORIZONTAL_PADDING_GRID_CELLS * state.viewport.vGrid,
			button.y + BUTTON_VERTICAL_PADDING_GRID_CELLS * state.viewport.hGrid,
			button.title,
			PALETTE_INDICES.selectionInk
		);
	}

	engine.endGroup();
}
