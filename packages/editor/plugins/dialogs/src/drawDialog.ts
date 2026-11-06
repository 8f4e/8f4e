import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import type { DrawContext } from '@8f4e/web-ui';
import { textToGlyphIds } from '@8f4e/web-ui';
import type { DialogLayout } from './types';

const DIALOG_CORNER = textToGlyphIds('+');
const BUTTON_HORIZONTAL_PADDING_GRID_CELLS = 4;
const BUTTON_VERTICAL_PADDING_GRID_CELLS = 1;

export default function drawDialog(engine: DrawContext, state: State, dialog: DialogLayout): void {
	if (state.dialogStack.length === 0) {
		return;
	}

	engine.startGroup(0, 0);
	engine.drawFill(0, 0, PALETTE_INDICES.scrim, state.viewport.width, state.viewport.height);
	engine.endGroup();

	engine.startGroup(dialog.x, dialog.y);

	engine.drawFill(0, 0, PALETTE_INDICES.floatingSurface, dialog.width, dialog.height);

	engine.drawGlyphs(0, 0, DIALOG_CORNER, PALETTE_INDICES.floatingInk);
	engine.drawGlyphs(dialog.width - state.viewport.vGrid, 0, DIALOG_CORNER, PALETTE_INDICES.floatingInk);
	engine.drawGlyphs(0, dialog.height - state.viewport.hGrid, DIALOG_CORNER, PALETTE_INDICES.floatingInk);
	engine.drawGlyphs(
		dialog.width - state.viewport.vGrid,
		dialog.height - state.viewport.hGrid,
		DIALOG_CORNER,
		PALETTE_INDICES.floatingInk
	);

	engine.drawGlyphs(state.viewport.vGrid, state.viewport.hGrid, dialog.title, PALETTE_INDICES.floatingAccent);

	for (let i = 0; i < dialog.wrappedText.length; i++) {
		const textY = state.viewport.hGrid * (3 + i);
		engine.drawGlyphs(state.viewport.vGrid, textY, dialog.wrappedText[i], PALETTE_INDICES.floatingInk);
	}

	for (let i = 0; i < dialog.buttons.length; i++) {
		const button = dialog.buttons[i];
		engine.drawFill(button.x, button.y, PALETTE_INDICES.selectionSurface, button.width, button.height);
		engine.drawGlyphs(
			button.x + BUTTON_HORIZONTAL_PADDING_GRID_CELLS * state.viewport.vGrid,
			button.y + BUTTON_VERTICAL_PADDING_GRID_CELLS * state.viewport.hGrid,
			button.title,
			PALETTE_INDICES.selectionInk
		);
	}

	engine.endGroup();
}
