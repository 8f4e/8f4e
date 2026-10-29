import { gapCalculator, parseEditorDirectives } from '@8f4e/editor-state';
import {
	getCodeBlockMemoryScope,
	resolveElementCount,
	resolveMemoryIdentifier,
	resolveTypedValueSpec,
} from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { createPlotDirectiveData } from '../helpers/data';
import type { Plot } from '../types';

export function registerPlotLayout(
	layout: EditorLayoutRegistry,
	plotsByBlock: WeakMap<CodeBlockGraphicData, Plot[]>
): () => void {
	const contribution = layout.createContribution();
	const unsubscribe = layout.subscribe(({ codeBlock: graphicData, state }) => {
		const items = parseEditorDirectives(graphicData.code, [{ name: 'plot' }]).flatMap(directive => {
			const data = createPlotDirectiveData(directive.args, directive.sourceLineIndex);
			return data ? [{ data, sourceLineIndex: directive.sourceLineIndex }] : [];
		});
		contribution.update(graphicData, {
			verticalSpaceAfterSourceLine: items.map(item => ({ sourceLineIndex: item.sourceLineIndex, heightInRows: 8 })),
		});
		plotsByBlock.set(graphicData, []);
		items.forEach(({ data }) => {
			const scope = getCodeBlockMemoryScope(graphicData);
			const startAddress = resolveMemoryIdentifier(state, scope, data.startAddressMemoryId);
			const length = resolveElementCount(data.length, scope, state);
			const valueSpec = startAddress ? resolveTypedValueSpec(startAddress) : undefined;

			if (!startAddress || !valueSpec || !length) {
				return;
			}

			const displayRow = graphicData.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;

			plotsByBlock.get(graphicData)!.push({
				x: (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid,
				y: (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
				width: graphicData.width - state.viewport.hGrid * 2,
				height: state.viewport.hGrid * 8,
				startAddress,
				baseSampleShift: valueSpec.baseSampleShift,
				length,
				valueType: valueSpec.valueType,
				minValue: data.minValueOverride ?? valueSpec.minValue,
				maxValue: data.maxValueOverride ?? valueSpec.maxValue,
			});
		});
	});
	return () => {
		unsubscribe();
		contribution.dispose();
	};
}
