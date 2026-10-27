import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../../drawContext';

export default function drawAssertions(engine: DrawContext, codeBlock: CodeBlockGraphicData): void {
	if (codeBlock.disabled) return;
	const colors = PALETTE_INDICES;
	for (const { x, y, width, height, passed } of codeBlock.widgets.assertions) {
		engine.drawFill(x, y, passed ? colors.positiveBase : colors.negativeBase, width, height);
	}
}
