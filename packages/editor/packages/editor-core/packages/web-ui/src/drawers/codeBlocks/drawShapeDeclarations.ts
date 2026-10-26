import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../drawContext';

export default function drawShapeDeclarations(
	engine: DrawContext,
	state: State,
	codeBlock: CodeBlockGraphicData
): void {
	if (!state.spriteLookups || codeBlock.widgets.shapeDeclarations.length === 0) {
		return;
	}

	const font = codeBlock.disabled ? state.spriteLookups.fontInkFaint : state.spriteLookups.fontInkBase;

	for (const { x, y, text } of codeBlock.widgets.shapeDeclarations) {
		engine.drawText(x, y, text, font);
	}
}
