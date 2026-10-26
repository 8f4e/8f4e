import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import type { DrawContext } from '@8f4e/web-ui';
import type { ButtonWidget } from '../types';

const OFF_LABEL = '[| ]';
const ON_LABEL = '[ |]';

export default function drawButton(engine: DrawContext, state: State, button: ButtonWidget, isOn: boolean): void {
	const knobX = button.x + state.viewport.vGrid * (isOn ? 2 : 1);
	engine.drawFill(button.x, button.y, PALETTE_INDICES.primaryDark2, button.width, button.height);
	engine.drawFill(knobX, button.y, PALETTE_INDICES.inkBase, state.viewport.vGrid, button.height);
	engine.drawText(button.x, button.y, isOn ? ON_LABEL : OFF_LABEL, PALETTE_INDICES.inkOn);
}
