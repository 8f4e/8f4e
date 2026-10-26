import type { DirectiveDerivedState, DirectiveWidgetContribution } from '@8f4e/editor-state-types';
import gapCalculator from '~/features/code-editing/gapCalculator';
import getCodeBlockMemoryScope from '~/pureHelpers/getCodeBlockMemoryScope';
import resolveMemoryIdentifier from '~/pureHelpers/resolveMemoryIdentifier';
import type { ButtonDirectiveData } from './data';

type DirectiveWidgetResolver = NonNullable<DirectiveWidgetContribution['onBlockLayoutReady']>;

function resolveButtonDirectiveWidget(
	button: ButtonDirectiveData,
	graphicData: Parameters<DirectiveWidgetResolver>[0],
	state: Parameters<DirectiveWidgetResolver>[1],
	directiveState: DirectiveDerivedState
): void {
	if (!graphicData.name) {
		return;
	}

	const memory = resolveMemoryIdentifier(state, getCodeBlockMemoryScope(graphicData), button.id)?.memory;

	if (!memory) {
		return;
	}

	const displayRow = directiveState.displayModel.rawRowToDisplayRow[button.lineNumber] ?? button.lineNumber;

	graphicData.widgets.buttons.push({
		width: state.viewport.vGrid * 4,
		height: state.viewport.hGrid,
		x: graphicData.width - 4 * state.viewport.vGrid,
		y: gapCalculator(displayRow, graphicData.gaps) * state.viewport.hGrid,
		id: memory.id,
		allocationUnitAddress: memory.allocationUnitAddress,
		isInteger: memory.isInteger ?? true,
		offValue: button.offValue,
		onValue: button.onValue,
	});
}

export function createButtonDirectiveWidgetContribution(button: ButtonDirectiveData): DirectiveWidgetContribution {
	return {
		onBlockLayoutReady: (graphicData, state, directiveState) => {
			resolveButtonDirectiveWidget(button, graphicData, state, directiveState);
		},
	};
}
