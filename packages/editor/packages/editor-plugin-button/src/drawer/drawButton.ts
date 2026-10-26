import type { State } from '@8f4e/editor-state-types';
import type { DrawContext } from '@8f4e/web-ui';
import type { ButtonWidget } from '../types';

const OFF_LABEL = '[| ]';
const ON_LABEL = '[ |]';

export default function drawButton(engine: DrawContext, state: State, button: ButtonWidget, isOn: boolean): void {
	const spriteLookups = state.spriteLookups!;

	const knobX = button.x + state.viewport.vGrid * (isOn ? 2 : 1);
	engine.drawSprite(button.x, button.y, spriteLookups.fillColors.switchBackground, button.width, button.height);
	engine.drawSprite(knobX, button.y, spriteLookups.fillColors.controlKnob, state.viewport.vGrid, button.height);
	engine.drawText(button.x, button.y, isOn ? ON_LABEL : OFF_LABEL, spriteLookups.fontControlKnob);
}
