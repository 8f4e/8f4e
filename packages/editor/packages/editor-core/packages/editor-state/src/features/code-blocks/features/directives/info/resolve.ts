import type { DirectiveDerivedState, DirectiveLayoutCallbacks } from '@8f4e/editor-state-types';
import gapCalculator from '~/features/code-editing/gapCalculator';
import type { InfoDirectiveData } from './data';
import type { InfoLayout } from './entries';

type DirectiveLayoutResolver = NonNullable<DirectiveLayoutCallbacks['onBlockLayoutReady']>;

const rowCountsByGraphicData = new WeakMap<Parameters<DirectiveLayoutResolver>[0], Map<string, number>>();

function trackInfoRowCount(
	info: InfoDirectiveData,
	layout: InfoLayout,
	graphicData: Parameters<DirectiveLayoutResolver>[0]
): void {
	let rowCounts = rowCountsByGraphicData.get(graphicData);
	if (!rowCounts) {
		rowCounts = new Map<string, number>();
		rowCountsByGraphicData.set(graphicData, rowCounts);
	}

	const previousRowCount = rowCounts.get(info.id);
	if (previousRowCount !== undefined && previousRowCount !== layout.rowCount) {
		graphicData.lastUpdated = Date.now();
	}

	rowCounts.set(info.id, layout.rowCount);
}

function resolveInfoDirectiveWidget(
	info: InfoDirectiveData,
	layout: InfoLayout,
	graphicData: Parameters<DirectiveLayoutResolver>[0],
	state: Parameters<DirectiveLayoutResolver>[1],
	directiveState: DirectiveDerivedState
): void {
	if (layout.rowCount === 0) {
		return;
	}

	const displayRow = directiveState.displayModel.rawRowToDisplayRow[info.lineNumber] ?? info.lineNumber;
	const x = (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid;
	const width = Math.max(state.viewport.vGrid, graphicData.width - x);

	graphicData.widgets.infoPanels.push({
		width,
		height: layout.rowCount * state.viewport.hGrid,
		x,
		y: (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
		id: info.id,
		rowCount: layout.rowCount,
		keyColumnWidth: layout.keyColumnWidth,
	});
}

export function createInfoDirectiveLayoutCallbacks(
	info: InfoDirectiveData,
	layout: InfoLayout
): DirectiveLayoutCallbacks {
	return {
		beforeGraphicDataWidthCalculation: graphicData => {
			trackInfoRowCount(info, layout, graphicData);
			if (layout.maxEntryWidth > 0) {
				graphicData.minGridWidth = Math.max(
					graphicData.minGridWidth ?? 0,
					layout.maxEntryWidth + graphicData.lineNumberColumnWidth + 3
				);
			}
		},
		onBlockLayoutReady: (graphicData, state, directiveState) => {
			resolveInfoDirectiveWidget(info, layout, graphicData, state, directiveState);
		},
	};
}
