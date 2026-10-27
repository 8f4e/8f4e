import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../../drawContext';

export default function drawBlockHighlights(engine: DrawContext, state: State, codeBlock: CodeBlockGraphicData): void {
	if (codeBlock.disabled) {
		return;
	}

	for (const { x, y, width, height, color } of codeBlock.widgets.blockHighlights) {
		engine.drawFill(x, y, PALETTE_INDICES[color], width, height);
	}
}
