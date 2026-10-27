import { gapCalculator } from '@8f4e/editor-state';
import {
	getCodeBlockMemoryScope,
	resolveElementCount,
	resolveMemoryIdentifier,
	resolveTypedValueSpec,
} from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorDirectiveDefinition } from '@8f4e/editor-state-types';
import { createBarsDirectiveData } from '../helpers/data';
import type { Bars } from '../types';

export function createBarsDirective(barsByBlock: WeakMap<CodeBlockGraphicData, Bars[]>): EditorDirectiveDefinition {
	return {
		name: 'bars',
		clearDerivedBlockData: codeBlock => {
			barsByBlock.set(codeBlock, []);
		},
		apply: (directive, draft) => {
			const data = createBarsDirectiveData(directive.args, directive.sourceLineIndex);
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
					const width = graphicData.width - (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid;
					const minValue = data.minValueOverride ?? valueSpec.minValue;
					const maxValue = data.maxValueOverride ?? valueSpec.maxValue;

					barsByBlock.get(graphicData)!.push({
						width,
						height: state.viewport.hGrid * 8,
						x: (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid,
						y: (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
						inverseValueRange: maxValue === minValue ? 0 : 1 / (maxValue - minValue),
						startAddress,
						baseSampleShift: valueSpec.baseSampleShift,
						length,
						valueType: valueSpec.valueType,
						minValue,
					});
				},
			});
		},
	};
}
