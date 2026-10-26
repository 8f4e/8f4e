import type { DirectiveDerivedState, DirectiveWidgetContribution } from '@8f4e/editor-state-types';
import gapCalculator from '~/features/code-editing/gapCalculator';
import getCodeBlockMemoryScope from '~/pureHelpers/getCodeBlockMemoryScope';
import resolveMemoryIdentifier from '~/pureHelpers/resolveMemoryIdentifier';
import { resolveDirectOrPointerTypedValueSpec } from '../shared/typedValueSpec';
import type { MeterDirectiveData } from './data';

type DirectiveWidgetResolver = NonNullable<DirectiveWidgetContribution['onBlockLayoutReady']>;

const GREEN_START_FACTOR = 0.75;
const RED_THRESHOLD = 0.9;

function resolveMeterDirectiveWidget(
	meter: MeterDirectiveData,
	graphicData: Parameters<DirectiveWidgetResolver>[0],
	state: Parameters<DirectiveWidgetResolver>[1],
	directiveState: DirectiveDerivedState
): void {
	if (!graphicData.name) {
		return;
	}

	const memory = resolveMemoryIdentifier(state, getCodeBlockMemoryScope(graphicData), meter.memoryId);
	const valueSpec = memory ? resolveDirectOrPointerTypedValueSpec(memory) : undefined;

	if (!memory || !valueSpec) {
		return;
	}

	const displayRow = directiveState.displayModel.rawRowToDisplayRow[meter.lineNumber] ?? meter.lineNumber;
	const minValue = meter.minValueOverride ?? valueSpec.minValue;
	const maxValue = meter.maxValueOverride ?? valueSpec.maxValue;
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

	graphicData.widgets.arrayMeters.push({
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
}

export function createMeterDirectiveWidgetContribution(meter: MeterDirectiveData): DirectiveWidgetContribution {
	return {
		onBlockLayoutReady: (graphicData, state, directiveState) => {
			resolveMeterDirectiveWidget(meter, graphicData, state, directiveState);
		},
	};
}
