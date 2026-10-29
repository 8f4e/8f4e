import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import type { BlockLayoutDraft } from './layout/types';

function getDisplayRow(sourceLineIndex: number, blockLayout: BlockLayoutDraft): number | undefined {
	return blockLayout.displayModel.sourceLineIndexToDisplayRow[sourceLineIndex];
}

function addGap(graphicData: CodeBlockGraphicData, displayRow: number, size: number): void {
	const existing = graphicData.gaps.get(displayRow);
	graphicData.gaps.set(displayRow, { size: (existing?.size ?? 0) + size });
}

export default function gaps(graphicData: CodeBlockGraphicData, blockLayout: BlockLayoutDraft) {
	graphicData.gaps.clear();

	// Error messages share the same source-line to display-row mapping as contributed space.
	graphicData.widgets.errorMessages.forEach(error => {
		const displayRow = getDisplayRow(error.lineNumber, blockLayout);
		if (displayRow !== undefined) {
			addGap(graphicData, displayRow, error.message.length);
		}
	});

	blockLayout.verticalSpaceAfterSourceLine.forEach(space => {
		const displayRow = getDisplayRow(space.sourceLineIndex, blockLayout);
		if (displayRow !== undefined) {
			addGap(graphicData, displayRow, space.heightInRows);
		}
	});
}
