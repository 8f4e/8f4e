import type { State } from '@8f4e/editor-state-types';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import type { Slider } from '../types';

const HANDLE_LABEL = '|';

export function drawSliders(engine: DrawContext, state: State, sliders: Slider[], memoryViews: MemoryViews): void {
	if (!state.spriteLookups) {
		return;
	}

	for (const { x, y, width, height, allocationUnitAddress, byteAddress, isInteger, isFloat64, min, max } of sliders) {
		const value = isInteger
			? memoryViews.int32[allocationUnitAddress]
			: isFloat64
				? memoryViews.float64[byteAddress / 8]
				: memoryViews.float32[allocationUnitAddress];

		// Handle edge case where min equals max
		if (min === max) {
			continue;
		}

		// Calculate normalized position (0..1)
		const normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
		const handleWidth = Math.min(state.viewport.vGrid, width);
		const trackWidth = Math.max(width - handleWidth, 1);
		const handleX = Math.floor(normalizedValue * trackWidth);

		engine.startGroup(x, y);

		engine.drawSprite(0, 0, state.spriteLookups.fillColors.surfaceRaised2, width, height);
		engine.drawSprite(0, 0, state.spriteLookups.fillColors.primaryDark2, handleX + handleWidth, height);
		engine.drawSprite(handleX, 0, state.spriteLookups.fillColors.inkBase, handleWidth, height);
		engine.drawText(handleX, 0, HANDLE_LABEL, state.spriteLookups.fontInkOn);
		engine.drawText(handleX, state.viewport.hGrid, HANDLE_LABEL, state.spriteLookups.fontInkOn);

		engine.endGroup();
	}
}
