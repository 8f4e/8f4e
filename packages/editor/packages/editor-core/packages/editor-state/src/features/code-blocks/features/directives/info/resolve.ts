import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import gapCalculator from '~/features/code-editing/gapCalculator';
import type { InfoDirectiveData } from './data';
import type { InfoLayout } from './entries';

const rowCountsByGraphicData = new WeakMap<CodeBlockGraphicData, Map<string, number>>();

function trackInfoRowCount(info: InfoDirectiveData, layout: InfoLayout, graphicData: CodeBlockGraphicData): void {
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

export function updateInfoPanel(
	info: InfoDirectiveData,
	layout: InfoLayout,
	graphicData: CodeBlockGraphicData,
	state: State
): void {
	trackInfoRowCount(info, layout, graphicData);
	if (layout.rowCount === 0) {
		return;
	}

	const displayRow = graphicData.displayModel.sourceLineIndexToDisplayRow[info.lineNumber] ?? info.lineNumber;
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
