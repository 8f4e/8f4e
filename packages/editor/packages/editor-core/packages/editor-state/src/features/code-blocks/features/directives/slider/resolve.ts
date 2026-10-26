import type { DirectiveDerivedState, DirectiveLayoutCallbacks } from '@8f4e/editor-state-types';
import gapCalculator from '~/features/code-editing/gapCalculator';
import getCodeBlockMemoryScope from '~/pureHelpers/getCodeBlockMemoryScope';
import resolveMemoryIdentifier from '~/pureHelpers/resolveMemoryIdentifier';
import type { SliderDirectiveData } from './data';

type DirectiveLayoutResolver = NonNullable<DirectiveLayoutCallbacks['onBlockLayoutReady']>;

function resolveSliderDirectiveWidget(
	slider: SliderDirectiveData,
	graphicData: Parameters<DirectiveLayoutResolver>[0],
	state: Parameters<DirectiveLayoutResolver>[1],
	directiveState: DirectiveDerivedState
): void {
	if (!graphicData.name) {
		return;
	}

	const memory = resolveMemoryIdentifier(state, getCodeBlockMemoryScope(graphicData), slider.memoryId);

	if (!memory) {
		return;
	}

	let min = slider.min;
	let max = slider.max;

	if (min === undefined || max === undefined) {
		if (memory.memory.isInteger) {
			min = min ?? 0;
			max = max ?? 127;
		} else {
			min = min ?? 0;
			max = max ?? 1;
		}
	}

	const displayRow = directiveState.displayModel.rawRowToDisplayRow[slider.lineNumber] ?? slider.lineNumber;

	graphicData.widgets.sliders.push({
		moduleId: memory.target.moduleId,
		width: graphicData.width - (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid,
		height: state.viewport.hGrid * 2,
		x: (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid,
		y: (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
		id: memory.memory.id,
		allocationUnitAddress: memory.memory.allocationUnitAddress,
		byteAddress: memory.memory.byteAddress,
		isInteger: memory.memory.isInteger ?? true,
		isFloat64: memory.memory.isFloat64,
		min,
		max,
		step: slider.step,
	});
}

export function createSliderDirectiveLayoutCallbacks(slider: SliderDirectiveData): DirectiveLayoutCallbacks {
	return {
		onBlockLayoutReady: (graphicData, state, directiveState) => {
			resolveSliderDirectiveWidget(slider, graphicData, state, directiveState);
		},
	};
}
