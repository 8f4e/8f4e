import { gapCalculator } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type {
	CodeBlockGraphicData,
	DirectiveDerivedState,
	DirectiveLayoutCallbacks,
	State,
} from '@8f4e/editor-state-types';
import type { SliderDirectiveData } from '../helpers/data';
import type { Slider } from '../types';

function resolveSliderDirectiveWidget(
	slider: SliderDirectiveData,
	graphicData: CodeBlockGraphicData,
	state: State,
	directiveState: DirectiveDerivedState,
	sliders: Slider[]
): void {
	if (!graphicData.name) {
		return;
	}

	const memory = resolveMemoryIdentifier(state, getCodeBlockMemoryScope(graphicData), slider.memoryId);

	if (!memory) {
		return;
	}

	const min = slider.min ?? 0;
	const max = slider.max ?? (memory.memory.isInteger ? 127 : 1);

	const displayRow =
		directiveState.displayModel.sourceLineIndexToDisplayRow[slider.sourceLineIndex] ?? slider.sourceLineIndex;

	sliders.push({
		moduleId: memory.target.moduleId,
		width: graphicData.width - (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid,
		height: state.viewport.hGrid * 2,
		x: (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid,
		y: (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
		id: memory.memory.id,
		allocationUnitAddress: memory.memory.allocationUnitAddress,
		byteAddress: memory.memory.byteAddress,
		isInteger: memory.memory.isInteger,
		isFloat64: memory.memory.isFloat64,
		min,
		max,
		step: slider.step,
	});
}

export function createSliderDirectiveLayoutCallbacks(
	slider: SliderDirectiveData,
	slidersByBlock: WeakMap<CodeBlockGraphicData, Slider[]>
): DirectiveLayoutCallbacks {
	return {
		onBlockLayoutReady: (graphicData, state, directiveState) => {
			resolveSliderDirectiveWidget(slider, graphicData, state, directiveState, slidersByBlock.get(graphicData)!);
		},
	};
}
