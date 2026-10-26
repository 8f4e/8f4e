import type { DirectiveDerivedState, DirectiveWidgetContribution } from '@8f4e/editor-state-types';
import gapCalculator from '~/features/code-editing/gapCalculator';
import getCodeBlockMemoryScope from '~/pureHelpers/getCodeBlockMemoryScope';
import resolveMemoryIdentifier from '~/pureHelpers/resolveMemoryIdentifier';
import type { CrossfadeDirectiveData } from './data';

type DirectiveWidgetResolver = NonNullable<DirectiveWidgetContribution['onBlockLayoutReady']>;

function resolveCrossfadeDirectiveWidget(
	crossfade: CrossfadeDirectiveData,
	graphicData: Parameters<DirectiveWidgetResolver>[0],
	state: Parameters<DirectiveWidgetResolver>[1],
	directiveState: DirectiveDerivedState
): void {
	if (!graphicData.name) {
		return;
	}

	const scope = getCodeBlockMemoryScope(graphicData);
	const leftMemory = resolveMemoryIdentifier(state, scope, crossfade.leftMemoryId);
	const rightMemory = resolveMemoryIdentifier(state, scope, crossfade.rightMemoryId);

	if (!leftMemory || !rightMemory) {
		return;
	}

	const left = leftMemory.memory;
	const right = rightMemory.memory;

	if (
		left.isInteger ||
		right.isInteger ||
		left.isFloat64 ||
		right.isFloat64 ||
		left.numberOfElements !== 1 ||
		right.numberOfElements !== 1
	) {
		return;
	}

	const displayRow = directiveState.displayModel.rawRowToDisplayRow[crossfade.lineNumber] ?? crossfade.lineNumber;
	const width = graphicData.width - (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid;
	const handleWidth = Math.min(state.viewport.vGrid, width);
	const trackWidth = Math.max(width - handleWidth, 1);

	graphicData.widgets.crossfades.push({
		width,
		height: state.viewport.hGrid * 2,
		x: (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid,
		y: (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
		leftId: left.id,
		rightId: right.id,
		leftWordAddress: left.allocationUnitAddress,
		rightWordAddress: right.allocationUnitAddress,
		handleWidth,
		trackWidth,
		centerX: Math.floor(trackWidth / 2),
	});
}

export function createCrossfadeDirectiveWidgetContribution(
	crossfade: CrossfadeDirectiveData
): DirectiveWidgetContribution {
	return {
		onBlockLayoutReady: (graphicData, state, directiveState) => {
			resolveCrossfadeDirectiveWidget(crossfade, graphicData, state, directiveState);
		},
	};
}
