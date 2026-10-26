import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import { BACKGROUND_COLUMNS, BACKGROUND_ROWS } from '@8f4e/sprite-generator';
import type { DrawContext } from '../drawContext';

export default function drawBackground(engine: DrawContext, state: State): void {
	if (!state.spriteLookups) return;
	engine.drawFill(0, 0, PALETTE_INDICES.canvasBase, state.viewport.width, state.viewport.height);
	const width = BACKGROUND_COLUMNS * state.viewport.vGrid;
	const height = BACKGROUND_ROWS * state.viewport.hGrid;
	for (let x = 0; x < state.viewport.width; x += width) {
		for (let y = 0; y < state.viewport.height; y += height) {
			engine.drawSprite(x, y, state.spriteLookups.background[0], PALETTE_INDICES.canvasDetail2);
			engine.drawSprite(x + state.viewport.vGrid, y, state.spriteLookups.background[0], PALETTE_INDICES.canvasDetail1);
		}
	}
}
