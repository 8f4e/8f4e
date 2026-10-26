import type { State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../drawContext';

const DIALOG_CORNER = '+';
const BUTTON_HORIZONTAL_PADDING_GRID_CELLS = 4;
const BUTTON_VERTICAL_PADDING_GRID_CELLS = 1;

export default function drawDialog(engine: DrawContext, state: State): void {
	if (state.dialogStack.length === 0 || !state.spriteLookups) {
		return;
	}

	engine.startGroup(0, 0);
	engine.drawSprite(0, 0, state.spriteLookups.fillColors.darkOverlay, state.viewport.width, state.viewport.height);
	engine.endGroup();

	engine.startGroup(state.dialog.x, state.dialog.y);

	engine.drawSprite(0, 0, state.spriteLookups.fillColors.floatingSurface, state.dialog.width, state.dialog.height);

	engine.drawText(0, 0, DIALOG_CORNER, state.spriteLookups.fontFloatingInk);
	engine.drawText(state.dialog.width - state.viewport.vGrid, 0, DIALOG_CORNER, state.spriteLookups.fontFloatingInk);
	engine.drawText(0, state.dialog.height - state.viewport.hGrid, DIALOG_CORNER, state.spriteLookups.fontFloatingInk);
	engine.drawText(
		state.dialog.width - state.viewport.vGrid,
		state.dialog.height - state.viewport.hGrid,
		DIALOG_CORNER,
		state.spriteLookups.fontFloatingInk
	);

	engine.drawText(
		state.viewport.vGrid,
		state.viewport.hGrid,
		state.dialog.title,
		state.spriteLookups.fontFloatingAccent
	);

	for (let i = 0; i < state.dialog.wrappedText.length; i++) {
		const textY = state.viewport.hGrid * (3 + i);
		engine.drawText(state.viewport.vGrid, textY, state.dialog.wrappedText[i], state.spriteLookups.fontFloatingInk);
	}

	for (let i = 0; i < state.dialog.buttons.length; i++) {
		const button = state.dialog.buttons[i];
		engine.drawSprite(button.x, button.y, state.spriteLookups.fillColors.selectionSurface, button.width, button.height);
		engine.drawText(
			button.x + BUTTON_HORIZONTAL_PADDING_GRID_CELLS * state.viewport.vGrid,
			button.y + BUTTON_VERTICAL_PADDING_GRID_CELLS * state.viewport.hGrid,
			button.title,
			state.spriteLookups.fontSelectionInk
		);
	}

	engine.endGroup();
}
