import type { State } from '@8f4e/editor-state-types';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import type { ButtonWidget } from '../types';
import drawButton from './drawButton';

export function drawButtons(draw: DrawContext, state: State, widgets: ButtonWidget[], memory: MemoryViews): void {
	const sprites = state.spriteLookups;
	if (!sprites) return;
	for (const button of widgets) {
		const value = (button.isInteger ? memory.int32 : memory.float32)[button.allocationUnitAddress];
		const onValue = button.isInteger ? button.onValue : Math.fround(button.onValue);
		const offValue = button.isInteger ? button.offValue : Math.fround(button.offValue);
		if (value === onValue || value === offValue) {
			drawButton(draw, state, button, value === onValue);
		} else {
			draw.drawText(button.x, button.y, '[__]', sprites.fontNumbers);
		}
	}
}
