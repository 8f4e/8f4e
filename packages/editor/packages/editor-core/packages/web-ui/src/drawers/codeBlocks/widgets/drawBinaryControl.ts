import type { BinaryControl, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../../drawContext';

const OFF_LABEL = '[| ]';
const ON_LABEL = '[ |]';

export default function drawBinaryControl(
	engine: DrawContext,
	state: State,
	control: Pick<BinaryControl, 'x' | 'y' | 'width' | 'height'>,
	isOn: boolean
): void {
	const spriteLookups = state.spriteLookups;
	if (!spriteLookups) {
		return;
	}

	const knobX = control.x + state.viewport.vGrid * (isOn ? 2 : 1);
	engine.drawSprite(control.x, control.y, spriteLookups.fillColors.switchBackground, control.width, control.height);
	engine.drawSprite(knobX, control.y, spriteLookups.fillColors.controlKnob, state.viewport.vGrid, control.height);
	engine.drawText(control.x, control.y, isOn ? ON_LABEL : OFF_LABEL, spriteLookups.fontControlKnob);
}
