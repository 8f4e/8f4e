import type {
	CodeBlockGraphicData,
	CodeBlockLayoutContribution,
	EditorDirectiveDefinition,
	State,
} from '@8f4e/editor-state-types';
import { deriveDirectiveState } from '../features/directives/registry';
import gaps from '../gaps';
import getCodeBlockGridWidth from '../getCodeBlockGridWidth';
import { updateCursorY } from '../updateCursorY';
import type { BlockLayoutDraft } from './types';

/** Update block display geometry and report whether its stacking partition changed. */
export function calculateBlockLayout(
	block: CodeBlockGraphicData,
	state: State,
	directives: EditorDirectiveDefinition[],
	contribution: CodeBlockLayoutContribution
): boolean {
	const directiveState = deriveDirectiveState(
		block.code,
		block.parsedDirectives,
		{ isExpandedForEditing: block === state.codeBlockRendering.selectedCodeBlock },
		directives
	);
	const displayModel = directiveState.displayModel;
	block.displayModel = displayModel;
	block.disabled = directiveState.blockState.disabled;
	block.lineNumberColumnWidth = block.code.length.toString().length;
	block.isCollapsed = displayModel.isCollapsed;
	const draft: BlockLayoutDraft = {
		displayModel,
		verticalSpaceAfterSourceLine: [...contribution.verticalSpaceAfterSourceLine],
	};
	block.minGridWidth = contribution.minGridWidth;
	gaps(block, draft);
	const { vGrid, hGrid } = state.viewport;
	block.width = getCodeBlockGridWidth(block.code, block.tabStopsByLine, block.minGridWidth) * vGrid;
	const gapRows = [...block.gaps.values()].reduce((total, gap) => total + gap.size, 0);
	block.height = (displayModel.lines.length + gapRows) * hGrid;
	block.x = block.gridX * vGrid;
	block.y = block.gridY * hGrid;
	updateCursorY(block, hGrid);
	const previousAlwaysOnTop = Boolean(block.alwaysOnTop);
	block.alwaysOnTop = directiveState.blockState.alwaysOnTop ?? false;
	return block.alwaysOnTop !== previousAlwaysOnTop;
}
