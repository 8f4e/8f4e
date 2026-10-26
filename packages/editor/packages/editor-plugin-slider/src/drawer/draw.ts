import { PALETTE_INDICES } from '@8f4e/editor-palette';
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

		engine.drawFill(0, 0, PALETTE_INDICES.surfaceRaised2, width, height);
		engine.drawFill(0, 0, PALETTE_INDICES.accentSurface, handleX + handleWidth, height);
		engine.drawFill(handleX, 0, PALETTE_INDICES.lightBase, handleWidth, height);
		engine.drawText(handleX, 0, HANDLE_LABEL, PALETTE_INDICES.darkBase);
		engine.drawText(handleX, state.viewport.hGrid, HANDLE_LABEL, PALETTE_INDICES.darkBase);

		engine.endGroup();
	}
}
