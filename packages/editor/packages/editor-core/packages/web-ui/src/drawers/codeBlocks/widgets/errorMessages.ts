import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../../drawContext';

export default function drawErrorMessages(engine: DrawContext, state: State, codeBlock: CodeBlockGraphicData): void {
	if (!state.spriteLookups) {
		return;
	}

	for (const { x, y, message } of codeBlock.widgets.errorMessages) {
		engine.drawFill(x, y, PALETTE_INDICES.negativeBase, codeBlock.width, message.length * state.viewport.hGrid);

		for (let i = 0; i < message.length; i++) {
			engine.drawText(x, y + i * state.viewport.hGrid, message[i], PALETTE_INDICES.negativeOn);
		}
	}
}
