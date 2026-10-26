import type { CodeBlockEntryOutline, State } from '@8f4e/editor-state-types';
import type { SpriteId } from '@8f4e/sprite-generator';
import type { DrawContext } from '../../drawContext';

function drawOutline(engine: DrawContext, outline: CodeBlockEntryOutline, thickness: number, spriteId: SpriteId): void {
	const left = outline.topLeft.x;
	const top = outline.topLeft.y;
	const width = outline.topRight.x - outline.topLeft.x;
	const height = outline.bottomLeft.y - outline.topLeft.y;
	const bottom = outline.bottomLeft.y - thickness;
	const right = outline.topRight.x - thickness;

	engine.drawSprite(left, top, spriteId, width, thickness);
	engine.drawSprite(left, bottom, spriteId, width, thickness);
	engine.drawSprite(left, top, spriteId, thickness, height);
	engine.drawSprite(right, top, spriteId, thickness, height);
}

export default function drawEntryOutlines(engine: DrawContext, state: State): void {
	if (!state.spriteLookups) {
		return;
	}

	const thickness = 1;

	for (const outline of state.codeBlockRendering.entryOutlines) {
		drawOutline(engine, outline, thickness, state.spriteLookups.fillColors.strokeBase);
		engine.drawText(
			outline.topLeft.x + state.viewport.vGrid,
			outline.topLeft.y,
			outline.entryName,
			state.spriteLookups.fontInkBase
		);
	}
}
