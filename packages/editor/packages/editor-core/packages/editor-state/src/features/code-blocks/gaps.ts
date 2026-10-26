import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import type { DirectiveDerivedState } from './features/directives/registry';
import { getVerticalSpaceAfterSourceLineRequests } from './features/directives/verticalSpaceAfterSourceLine';

function getDisplayRow(sourceLineIndex: number, directiveState: DirectiveDerivedState): number | undefined {
	return directiveState.displayModel.sourceLineIndexToDisplayRow[sourceLineIndex];
}

function addGap(graphicData: CodeBlockGraphicData, displayRow: number, size: number): void {
	const existing = graphicData.gaps.get(displayRow);
	graphicData.gaps.set(displayRow, { size: (existing?.size ?? 0) + size });
}

export default function gaps(graphicData: CodeBlockGraphicData, directiveState: DirectiveDerivedState) {
	graphicData.gaps.clear();

	// TODO: Error messages should request space through addVerticalSpaceAfterSourceLine too.
	graphicData.widgets.errorMessages.forEach(error => {
		const displayRow = getDisplayRow(error.lineNumber, directiveState);
		if (displayRow !== undefined) {
			addGap(graphicData, displayRow, error.message.length);
		}
	});

	getVerticalSpaceAfterSourceLineRequests(directiveState).forEach(space => {
		const displayRow = getDisplayRow(space.sourceLineIndex, directiveState);
		if (displayRow !== undefined) {
			addGap(graphicData, displayRow, space.heightInRows);
		}
	});
}
