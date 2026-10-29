import { gapCalculator, matchEditorDirectives } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry, State } from '@8f4e/editor-state-types';
import type { SliderDirectiveData } from '../helpers/data';
import { createSliderDirectiveData } from '../helpers/data';
import type { Slider } from '../types';

function resolveSliderLayout(
	slider: SliderDirectiveData,
	graphicData: CodeBlockGraphicData,
	state: State,
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
		graphicData.displayModel.sourceLineIndexToDisplayRow[slider.sourceLineIndex] ?? slider.sourceLineIndex;

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

export function registerSliderLayout(
	layout: EditorLayoutRegistry,
	slidersByBlock: WeakMap<CodeBlockGraphicData, Slider[]>
): () => void {
	const contribution = layout.createContribution();
	const unsubscribe = layout.subscribe(({ codeBlock, state }) => {
		const items = matchEditorDirectives(codeBlock.parsedDirectives, [{ name: 'slider' }]).flatMap(directive => {
			const data = createSliderDirectiveData(directive.args, directive.sourceLineIndex);
			return data ? [data] : [];
		});
		contribution.update(codeBlock, {
			verticalSpaceAfterSourceLine: items.map(data => ({ sourceLineIndex: data.sourceLineIndex, heightInRows: 2 })),
		});
		const widgets: Slider[] = [];
		slidersByBlock.set(codeBlock, widgets);
		for (const data of items) resolveSliderLayout(data, codeBlock, state, widgets);
	});
	return () => {
		unsubscribe();
		contribution.dispose();
	};
}
