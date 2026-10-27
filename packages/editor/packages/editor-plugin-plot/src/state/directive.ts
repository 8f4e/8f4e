import { gapCalculator } from '@8f4e/editor-state';
import {
	getCodeBlockMemoryScope,
	resolveElementCount,
	resolveMemoryIdentifier,
	resolveTypedValueSpec,
} from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorDirectiveDefinition } from '@8f4e/editor-state-types';
import { createPlotDirectiveData } from '../helpers/data';
import type { Plot } from '../types';

export function createPlotDirective(plotsByBlock: WeakMap<CodeBlockGraphicData, Plot[]>): EditorDirectiveDefinition {
	return {
		name: 'plot',
		clearDerivedBlockData: codeBlock => {
			plotsByBlock.set(codeBlock, []);
		},
		apply: (directive, draft) => {
			const data = createPlotDirectiveData(directive.args, directive.sourceLineIndex);
			if (!data) return;
			draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 8 });
			draft.layoutCallbacks.push({
				onBlockLayoutReady: (graphicData, state, directiveState) => {
					const scope = getCodeBlockMemoryScope(graphicData);
					const startAddress = resolveMemoryIdentifier(state, scope, data.startAddressMemoryId);
					const length = resolveElementCount(data.length, scope, state);
					const valueSpec = startAddress ? resolveTypedValueSpec(startAddress) : undefined;

					if (!startAddress || !valueSpec || !length) {
						return;
					}

					const displayRow =
						directiveState.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;

					plotsByBlock.get(graphicData)!.push({
						x: (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid,
						y: (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
						startAddress,
						baseSampleShift: valueSpec.baseSampleShift,
						length,
						valueType: valueSpec.valueType,
						minValue: data.minValueOverride ?? valueSpec.minValue,
						maxValue: data.maxValueOverride ?? valueSpec.maxValue,
					});
				},
			});
		},
	};
}
