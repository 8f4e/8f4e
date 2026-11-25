import type { EditorPluginContext } from '@8f4e/editor-core';
import { displayRowToGridRow, matchEditorDirectives, subscribeToBlockPreparation } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryAddress } from '@8f4e/editor-state/memory';
import type { EditorCodeBlock, EditorLayoutRegistry, State } from '@8f4e/editor-state-types';
import type { SliderDirectiveData } from '../helpers/data';
import { createSliderDirectiveData } from '../helpers/data';
import type { Slider } from '../types';

function resolveSliderLayout(
	slider: SliderDirectiveData,
	graphicData: EditorCodeBlock,
	state: State,
	sliders: Slider[]
): void {
	if (!graphicData.name) {
		return;
	}

	const memory = resolveMemoryAddress(state, getCodeBlockMemoryScope(graphicData), slider.memoryId);

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
		y: (displayRowToGridRow(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
		memoryName: memory.memory.name!,
		allocationUnitAddress: memory.memory.allocationUnitAddress,
		byteAddress: memory.memory.byteAddress,
		isInteger: memory.memory.isInteger,
		isFloat64: memory.memory.isFloat64,
		min,
		max,
		step: slider.step,
	});
}

export function registerSliderPreparation(
	store: EditorPluginContext['store'],
	layout: EditorLayoutRegistry,
	slidersByBlock: WeakMap<EditorCodeBlock, Slider[]>
): () => void {
	const contribution = layout.createContribution();
	const unsubscribe = subscribeToBlockPreparation(store, layout, 'compiler.result', ({ codeBlock, state }, reason) => {
		const items = matchEditorDirectives(codeBlock.parsedDirectives, [{ name: 'slider' }]).flatMap(directive => {
			const data = createSliderDirectiveData(directive.args, directive.sourceLineIndex);
			return data ? [data] : [];
		});
		if (reason === 'layout') {
			contribution.update(codeBlock, {
				verticalSpaceAfterSourceLine: items.map(data => ({ sourceLineIndex: data.sourceLineIndex, heightInRows: 2 })),
			});
		}
		const widgets: Slider[] = [];
		slidersByBlock.set(codeBlock, widgets);
		for (const data of items) resolveSliderLayout(data, codeBlock, state, widgets);
	});
	return () => {
		unsubscribe();
		contribution.dispose();
	};
}
