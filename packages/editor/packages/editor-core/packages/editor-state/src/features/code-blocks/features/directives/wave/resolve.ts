import type { DirectiveDerivedState, DirectiveLayoutCallbacks } from '@8f4e/editor-state-types';
import gapCalculator from '~/features/code-editing/gapCalculator';
import getCodeBlockMemoryScope from '~/pureHelpers/getCodeBlockMemoryScope';
import resolveMemoryIdentifier from '~/pureHelpers/resolveMemoryIdentifier';
import { resolveElementCount, resolveTypedValueSpec } from '../shared/typedValueSpec';
import type { WaveDirectiveData } from './data';

type DirectiveLayoutResolver = NonNullable<DirectiveLayoutCallbacks['onBlockLayoutReady']>;

function resolveWaveDirectiveWidget(
	wave: WaveDirectiveData,
	graphicData: Parameters<DirectiveLayoutResolver>[0],
	state: Parameters<DirectiveLayoutResolver>[1],
	directiveState: DirectiveDerivedState
): void {
	if (!graphicData.name) {
		return;
	}

	const scope = getCodeBlockMemoryScope(graphicData);
	const startAddress = resolveMemoryIdentifier(state, scope, wave.startAddressMemoryId);
	const length = resolveElementCount(wave.length, scope, state);
	const pointer = resolveMemoryIdentifier(state, scope, wave.pointerMemoryId);
	const valueSpec = startAddress ? resolveTypedValueSpec(startAddress) : undefined;

	if (!startAddress || !length || !valueSpec || valueSpec.elementByteSize <= 0) {
		return;
	}

	const displayRow = directiveState.displayModel.rawRowToDisplayRow[wave.lineNumber] ?? wave.lineNumber;

	graphicData.widgets.arrayWaves.push({
		width: graphicData.width - (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid,
		height: state.viewport.hGrid * wave.heightRows,
		x: (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid,
		y: (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
		startAddress,
		elementByteSize: valueSpec.elementByteSize,
		inverseElementByteSize: 1 / valueSpec.elementByteSize,
		baseSampleShift: valueSpec.baseSampleShift,
		length,
		pointer,
		valueType: valueSpec.valueType,
		minValue: valueSpec.minValue,
		maxValue: valueSpec.maxValue,
		inverseValueRange: valueSpec.maxValue === valueSpec.minValue ? 0 : 1 / (valueSpec.maxValue - valueSpec.minValue),
	});
}

export function createWaveDirectiveLayoutCallbacks(wave: WaveDirectiveData): DirectiveLayoutCallbacks {
	return {
		onBlockLayoutReady: (graphicData, state, directiveState) => {
			resolveWaveDirectiveWidget(wave, graphicData, state, directiveState);
		},
	};
}
