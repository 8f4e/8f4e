import type { PaletteIndex } from '@8f4e/editor-palette';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { CodeBlockEntryOutline, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../drawContext';

function drawOutline(
	engine: DrawContext,
	outline: CodeBlockEntryOutline,
	thickness: number,
	color: PaletteIndex
): void {
	const left = outline.topLeft.x;
	const top = outline.topLeft.y;
	const width = outline.topRight.x - outline.topLeft.x;
	const height = outline.bottomLeft.y - outline.topLeft.y;
	const bottom = outline.bottomLeft.y - thickness;
	const right = outline.topRight.x - thickness;

	engine.drawFill(left, top, color, width, thickness);
	engine.drawFill(left, bottom, color, width, thickness);
	engine.drawFill(left, top, color, thickness, height);
	engine.drawFill(right, top, color, thickness, height);
}

export default function drawEntryOutlines(engine: DrawContext, state: State): void {
	if (!state.spriteLookups) {
		return;
	}

	const thickness = 1;

	for (const outline of state.codeBlockRendering.entryOutlines) {
		drawOutline(engine, outline, thickness, PALETTE_INDICES.strokeBase);
		engine.drawText(
			outline.topLeft.x + state.viewport.vGrid,
			outline.topLeft.y,
			outline.entryName,
			PALETTE_INDICES.inkBase
		);
	}
}
