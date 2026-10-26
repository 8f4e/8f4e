import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../drawContext';
import { calculateArrowPlacement } from './arrowPlacement';

const ARROW_CHARACTERS = {
	top: '^',
	right: '>',
	bottom: 'v',
	left: '<',
} as const;

/**
 * Draws directional arrow indicators for an off-screen code block.
 * Arrows are positioned at viewport edges to indicate the direction of off-screen modules.
 *
 * @param engine - The rendering engine
 * @param codeBlock - The off-screen code block to draw arrows for
 * @param state - The editor state containing viewport and sprite lookup information
 */
export default function drawArrow(engine: DrawContext, codeBlock: CodeBlockGraphicData, state: State): void {
	const arrowPlacement = calculateArrowPlacement(codeBlock, state);
	const font = PALETTE_INDICES.primaryBase;
	if (!state.spriteLookups) {
		return;
	}

	if (arrowPlacement.top) {
		engine.drawText(arrowPlacement.top.x, arrowPlacement.top.y, ARROW_CHARACTERS.top, font);
	}

	if (arrowPlacement.right) {
		engine.drawText(
			arrowPlacement.right.x - state.viewport.vGrid,
			arrowPlacement.right.y,
			ARROW_CHARACTERS.right,
			font
		);
	}

	if (arrowPlacement.bottom) {
		engine.drawText(
			arrowPlacement.bottom.x,
			arrowPlacement.bottom.y - state.viewport.hGrid,
			ARROW_CHARACTERS.bottom,
			font
		);
	}

	if (arrowPlacement.left) {
		engine.drawText(arrowPlacement.left.x, arrowPlacement.left.y, ARROW_CHARACTERS.left, font);
	}
}
