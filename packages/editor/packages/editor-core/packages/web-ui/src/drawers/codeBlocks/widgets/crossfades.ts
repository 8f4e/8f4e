import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../../drawContext';
import type { MemoryViews } from '../../../types';

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

export default function drawer(
	engine: DrawContext,
	state: State,
	codeBlock: CodeBlockGraphicData,
	memoryViews: MemoryViews
): void {
	if (!codeBlock.name) {
		return;
	}

	for (const crossfade of codeBlock.widgets.crossfades) {
		const leftValue = clamp(memoryViews.float32[crossfade.leftWordAddress] ?? 0, 0, 1);
		const rightValue = clamp(memoryViews.float32[crossfade.rightWordAddress] ?? 0, 0, 1);
		const position = clamp(rightValue - leftValue, -1, 1);
		const handleX = Math.round(((position + 1) / 2) * crossfade.trackWidth);

		engine.startGroup(crossfade.x, crossfade.y);
		engine.drawFill(0, 0, PALETTE_INDICES.surfaceRaised2, crossfade.width, crossfade.height);

		if (handleX !== crossfade.centerX) {
			const fillX = Math.min(crossfade.centerX, handleX);
			const fillWidth = Math.abs(handleX - crossfade.centerX) + crossfade.handleWidth;
			engine.drawFill(fillX, 0, PALETTE_INDICES.accentSurface, fillWidth, crossfade.height);
		}

		engine.drawFill(handleX, 0, PALETTE_INDICES.lightBase, crossfade.handleWidth, crossfade.height);
		engine.endGroup();
	}
}
