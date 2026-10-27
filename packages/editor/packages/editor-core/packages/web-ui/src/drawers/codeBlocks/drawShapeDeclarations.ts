import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../drawContext';

export default function drawShapeDeclarations(
	engine: DrawContext,
	state: State,
	codeBlock: CodeBlockGraphicData
): void {
	if (codeBlock.widgets.shapeDeclarations.length === 0) {
		return;
	}

	const color = codeBlock.disabled ? PALETTE_INDICES.inkFaint : PALETTE_INDICES.inkBase;

	for (const { x, y, text } of codeBlock.widgets.shapeDeclarations) {
		engine.drawText(x, y, text, color);
	}
}
