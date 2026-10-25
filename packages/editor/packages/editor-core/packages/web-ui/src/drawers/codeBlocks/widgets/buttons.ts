import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../../drawContext';
import type { MemoryViews } from '../../../types';
import drawButton from './drawButton';

export default function drawButtons(
	engine: DrawContext,
	state: State,
	codeBlock: CodeBlockGraphicData,
	memoryViews: MemoryViews
): void {
	if (!state.spriteLookups) {
		return;
	}

	for (const button of codeBlock.widgets.buttons) {
		const value = memoryViews.int32[button.allocationUnitAddress] || 0;

		if (value === button.onValue) {
			drawButton(engine, state, button, true);
		} else if (value === button.offValue) {
			drawButton(engine, state, button, false);
		} else {
			engine.drawText(button.x, button.y, '[__]', state.spriteLookups.fontNumbers);
		}
	}
}
