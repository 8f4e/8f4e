import type { DirectiveDerivedState, DirectiveLayoutCallbacks } from '@8f4e/editor-state-types';
import gapCalculator from '~/features/code-editing/gapCalculator';
import { getTabStopsByLine, getVisualLineWidth } from '~/features/code-editing/tabLayout';
import getCodeBlockMemoryScope from '~/pureHelpers/getCodeBlockMemoryScope';
import resolveMemoryIdentifier from '~/pureHelpers/resolveMemoryIdentifier';
import type { WatchDirectiveData } from './data';

type DirectiveLayoutResolver = NonNullable<DirectiveLayoutCallbacks['onBlockLayoutReady']>;

function resolveWatchDirectiveWidget(
	_debugger: WatchDirectiveData,
	graphicData: Parameters<DirectiveLayoutResolver>[0],
	state: Parameters<DirectiveLayoutResolver>[1],
	directiveState: DirectiveDerivedState
): void {
	if (!graphicData.name) {
		return;
	}

	const memory = resolveMemoryIdentifier(state, getCodeBlockMemoryScope(graphicData), _debugger.id);
	if (!memory) {
		return;
	}

	const displayRow =
		directiveState.displayModel.sourceLineIndexToDisplayRow[_debugger.lineNumber] ?? _debugger.lineNumber;
	const tabStopsByLine = getTabStopsByLine(graphicData.code);
	const visualLineWidth = getVisualLineWidth(
		graphicData.code[_debugger.lineNumber] || '',
		tabStopsByLine[_debugger.lineNumber] || []
	);

	graphicData.widgets.debuggers.push({
		width: state.viewport.vGrid * 2,
		height: state.viewport.hGrid,
		x: state.viewport.vGrid * (3 + graphicData.lineNumberColumnWidth + visualLineWidth),
		y: gapCalculator(displayRow, graphicData.gaps) * state.viewport.hGrid,
		id: _debugger.id,
		memory: memory.memory,
		showAddress: memory.showAddress,
		showEndAddress: memory.showEndAddress,
		displayFormat: memory.displayFormat,
		bufferPointer: memory.bufferPointer,
	});
}

export function createWatchDirectiveLayoutCallbacks(_debugger: WatchDirectiveData): DirectiveLayoutCallbacks {
	return {
		onBlockLayoutReady: (graphicData, state, directiveState) => {
			resolveWatchDirectiveWidget(_debugger, graphicData, state, directiveState);
		},
	};
}
