import type { CodeBlockLayoutContribution, EditorCodeBlock, State } from '@8f4e/editor-state-types';
import buildDisplayModel from './buildDisplayModel';
import getCodeBlockGridWidth from './getCodeBlockGridWidth';
import updateBlockGaps from './updateBlockGaps';
import { updateCursorY } from './updateCursorY';

/** Update block display geometry from the current source facts and selection. */
export function calculateBlockLayout(
	block: EditorCodeBlock,
	state: State,
	contribution: CodeBlockLayoutContribution
): void {
	const displayModel = buildDisplayModel(block.code, {
		...block.directiveDisplayState,
		isExpandedForEditing: block === state.project.selectedCodeBlock,
	});
	block.displayModel = displayModel;
	block.lineNumberColumnWidth = block.code.length.toString().length;
	block.isCollapsed = displayModel.isCollapsed;
	block.minGridWidth = contribution.minGridWidth;
	updateBlockGaps(block, contribution.verticalSpaceAfterSourceLine);
	const { vGrid, hGrid } = state.viewport;
	block.width = getCodeBlockGridWidth(block.code, block.tabStopsByLine, block.minGridWidth) * vGrid;
	const gapRows = [...block.gaps.values()].reduce((total, gap) => total + gap.size, 0);
	block.height = (displayModel.lines.length + gapRows) * hGrid;
	block.x = block.gridX * vGrid;
	block.y = block.gridY * hGrid;
	updateCursorY(block, hGrid);
}
