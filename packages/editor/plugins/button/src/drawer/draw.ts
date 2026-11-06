import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import { textToGlyphIds } from '@8f4e/web-ui';
import type { ButtonWidget } from '../types';
import drawButton from './drawButton';

const INVALID_LABEL = textToGlyphIds('[__]');

export function drawButtons(draw: DrawContext, state: State, buttons: ButtonWidget[], memory: MemoryViews): void {
	for (const button of buttons) {
		const value = (button.isInteger ? memory.int32 : memory.float32)[button.allocationUnitAddress];
		const onValue = button.isInteger ? button.onValue : Math.fround(button.onValue);
		const offValue = button.isInteger ? button.offValue : Math.fround(button.offValue);
		if (value === onValue || value === offValue) {
			drawButton(draw, state, button, value === onValue);
		} else {
			draw.drawGlyphs(button.x, button.y, INVALID_LABEL, PALETTE_INDICES.secondaryBase);
		}
	}
}
