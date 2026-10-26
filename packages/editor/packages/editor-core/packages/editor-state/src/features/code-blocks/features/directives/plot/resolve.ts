import type { DirectiveDerivedState, DirectiveWidgetContribution } from '@8f4e/editor-state-types';
import gapCalculator from '~/features/code-editing/gapCalculator';
import getCodeBlockMemoryScope from '~/pureHelpers/getCodeBlockMemoryScope';
import resolveMemoryIdentifier from '~/pureHelpers/resolveMemoryIdentifier';
import { resolveElementCount, resolveTypedValueSpec } from '../shared/typedValueSpec';
import type { PlotDirectiveData } from './data';

type DirectiveWidgetResolver = NonNullable<DirectiveWidgetContribution['onBlockLayoutReady']>;

function resolvePlotDirectiveWidget(
	plotter: PlotDirectiveData,
	graphicData: Parameters<DirectiveWidgetResolver>[0],
	state: Parameters<DirectiveWidgetResolver>[1],
	directiveState: DirectiveDerivedState
): void {
	if (!graphicData.name) {
		return;
	}

	const scope = getCodeBlockMemoryScope(graphicData);
	const startAddress = resolveMemoryIdentifier(state, scope, plotter.startAddressMemoryId);
	const length = resolveElementCount(plotter.length, scope, state);
	const valueSpec = startAddress ? resolveTypedValueSpec(startAddress) : undefined;

	if (!startAddress || !valueSpec || !length) {
		return;
	}

	const displayRow = directiveState.displayModel.rawRowToDisplayRow[plotter.lineNumber] ?? plotter.lineNumber;

	graphicData.widgets.arrayPlotters.push({
		width: state.viewport.vGrid * 2,
		height: state.viewport.hGrid,
		x: (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid,
		y: (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
		startAddress,
		baseSampleShift: valueSpec.baseSampleShift,
		length,
		valueType: valueSpec.valueType,
		minValue: plotter.minValueOverride ?? valueSpec.minValue,
		maxValue: plotter.maxValueOverride ?? valueSpec.maxValue,
	});
}

export function createPlotDirectiveWidgetContribution(plotter: PlotDirectiveData): DirectiveWidgetContribution {
	return {
		onBlockLayoutReady: (graphicData, state, directiveState) => {
			resolvePlotDirectiveWidget(plotter, graphicData, state, directiveState);
		},
	};
}
