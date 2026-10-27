import { gapCalculator } from '@8f4e/editor-state';
import {
	getCodeBlockMemoryScope,
	resolveDirectOrPointerTypedValueSpec,
	resolveMemoryIdentifier,
} from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorDirectiveDefinition } from '@8f4e/editor-state-types';
import { createMeterDirectiveData } from '../helpers/data';
import type { Meter } from '../types';

const GREEN_START_FACTOR = 0.75;
const RED_THRESHOLD = 0.9;

export function createMeterDirective(metersByBlock: WeakMap<CodeBlockGraphicData, Meter[]>): EditorDirectiveDefinition {
	return {
		name: 'meter',
		allowTrailingComment: true,
		clearDerivedBlockData: codeBlock => {
			metersByBlock.set(codeBlock, []);
		},
		apply: (directive, draft) => {
			const data = createMeterDirectiveData(directive.args, directive.sourceLineIndex, directive.sourceLine);
			if (!data) return;
			draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 1 });
			draft.layoutCallbacks.push({
				onBlockLayoutReady: (graphicData, state, directiveState) => {
					const memory = resolveMemoryIdentifier(state, getCodeBlockMemoryScope(graphicData), data.memoryId);
					const valueSpec = memory ? resolveDirectOrPointerTypedValueSpec(memory) : undefined;

					if (!memory || !valueSpec) {
						return;
					}

					const displayRow =
						directiveState.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;
					const minValue = data.minValueOverride ?? valueSpec.minValue;
					const maxValue = data.maxValueOverride ?? valueSpec.maxValue;
					const width = graphicData.width - (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid;
					const isBipolar = minValue < 0 && maxValue > 0;
					const amplitudeLimit = isBipolar ? Math.max(Math.abs(minValue), Math.abs(maxValue)) : 0;
					const inverseValueRange = maxValue === minValue ? 0 : 1 / (maxValue - minValue);
					const greenEndX = Math.floor(width * RED_THRESHOLD * GREEN_START_FACTOR);
					const yellowEndX = Math.floor(width * RED_THRESHOLD);
					const overloadMarkerWidth = Math.min(state.viewport.vGrid, width);
					const staticValueIndex =
						memory.showAddress || !memory.memory.pointerDepth
							? (memory.memory.byteAddress >> valueSpec.baseSampleShift) + memory.bufferPointer
							: undefined;

					metersByBlock.get(graphicData)!.push({
						width,
						height: state.viewport.hGrid,
						x: (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid,
						y: (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
						isBipolar,
						amplitudeLimit,
						inverseValueRange,
						greenEndX,
						yellowEndX,
						overloadMarkerX: width - overloadMarkerWidth,
						overloadMarkerWidth,
						staticValueIndex,
						memory,
						baseSampleShift: valueSpec.baseSampleShift,
						valueType: valueSpec.valueType,
						minValue,
						maxValue,
					});
				},
			});
		},
	};
}
