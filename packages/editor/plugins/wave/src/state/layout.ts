import { gapCalculator, parseEditorDirectives } from '@8f4e/editor-state';
import {
	getCodeBlockMemoryScope,
	resolveElementCount,
	resolveMemoryIdentifier,
	resolveTypedValueSpec,
} from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { createWaveDirectiveData } from '../helpers/data';
import type { Wave } from '../types';

export function registerWaveLayout(
	layout: EditorLayoutRegistry,
	wavesByBlock: WeakMap<CodeBlockGraphicData, Wave[]>
): () => void {
	const contribution = layout.createContribution();
	const heights = { wave: 2, wave2: 4, wave4: 8 };
	const unsubscribe = layout.subscribe(({ codeBlock, state }) => {
		const items = parseEditorDirectives(
			codeBlock.code,
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
		wavesByBlock.set(codeBlock, []);
		items.forEach(({ data, heightRows }) => {
			const scope = getCodeBlockMemoryScope(codeBlock);
			const source = resolveMemoryIdentifier(state, scope, data.startAddressMemoryId);
			const elementCount = resolveElementCount(data.length, scope, state);
			const spec = source ? resolveTypedValueSpec(source) : undefined;
			if (!source || !elementCount || !spec) return;
			const row = codeBlock.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;
			wavesByBlock.get(codeBlock)!.push({
				width: codeBlock.width - (codeBlock.lineNumberColumnWidth + 2) * state.viewport.vGrid,
				height: state.viewport.hGrid * heightRows,
				x: (codeBlock.lineNumberColumnWidth + 2) * state.viewport.vGrid,
				y: (gapCalculator(row, codeBlock.gaps) + 1) * state.viewport.hGrid,
				source,
				elementCount,
				playhead: resolveMemoryIdentifier(state, scope, data.pointerMemoryId),
				inverseElementByteSize: 1 / spec.elementByteSize,
				baseSampleShift: spec.baseSampleShift,
				valueType: spec.valueType,
				minValue: spec.minValue,
				maxValue: spec.maxValue,
				inverseValueRange: 1 / (spec.maxValue - spec.minValue),
			});
		});
	});
	return () => {
		unsubscribe();
		contribution.dispose();
	};
}
