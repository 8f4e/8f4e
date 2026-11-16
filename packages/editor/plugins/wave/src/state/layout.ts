import { gapCalculator, matchEditorDirectives } from '@8f4e/editor-state';
import {
	getCodeBlockMemoryScope,
	prepareAddressBinding,
	prepareBuffer,
	prepareMemoryAccess,
} from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { createWaveDirectiveData } from '../helpers/data';
import { createWaveformPeaks, MAX_WAVEFORM_SAMPLE_READS } from '../helpers/peaks';
import type { Wave } from '../types';

export function registerWaveLayout(
	layout: EditorLayoutRegistry,
	wavesByBlock: WeakMap<CodeBlockGraphicData, Wave[]>
): () => void {
	const contribution = layout.createContribution();
	const heights = { wave: 2, wave2: 4, wave4: 8 };
	const unsubscribe = layout.subscribe(({ codeBlock, state }) => {
		const items = matchEditorDirectives(
			codeBlock.parsedDirectives,
			Object.keys(heights).map(name => ({ name }))
		).flatMap(directive => {
			const data = createWaveDirectiveData(directive.args, directive.sourceLineIndex);
			return data
				? [
						{
							data,
							heightRows: heights[directive.name as keyof typeof heights],
						},
					]
				: [];
		});
		contribution.update(codeBlock, {
			verticalSpaceAfterSourceLine: items.map(item => ({
				sourceLineIndex: item.data.lineNumber,
				heightInRows: item.heightRows,
			})),
		});
		const waves: Wave[] = [];
		items.forEach(({ data, heightRows }) => {
			const scope = getCodeBlockMemoryScope(codeBlock);
			const buffer = prepareBuffer(state, scope, data.startAddressMemoryId, data.length);
			if (!buffer) return;
			const spec = buffer.samples.spec;
			const playhead = prepareMemoryAccess(state, scope, data.pointerMemoryId);
			const row = codeBlock.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;
			const width = codeBlock.width - (codeBlock.lineNumberColumnWidth + 2) * state.viewport.vGrid;
			const columnWidth = Math.max(1, Math.floor(state.viewport.vGrid / 2));
			const columnCount = Math.min(MAX_WAVEFORM_SAMPLE_READS, Math.max(1, Math.floor(width / columnWidth)));
			waves.push({
				width,
				height: state.viewport.hGrid * heightRows,
				x: (codeBlock.lineNumberColumnWidth + 2) * state.viewport.vGrid,
				y: (gapCalculator(row, codeBlock.gaps) + 1) * state.viewport.hGrid,
				buffer,
				playhead: playhead && prepareAddressBinding(playhead),
				inverseElementByteSize: 1 / spec.elementByteSize,
				minValue: spec.minValue,
				maxValue: spec.maxValue,
				inverseValueRange: 1 / (spec.maxValue - spec.minValue),
				peaks: createWaveformPeaks(columnCount),
			});
		});
		wavesByBlock.set(codeBlock, waves);
	});
	return () => {
		unsubscribe();
		contribution.dispose();
	};
}
