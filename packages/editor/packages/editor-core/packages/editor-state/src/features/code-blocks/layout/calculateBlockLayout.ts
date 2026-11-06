import type {
	CodeBlockGraphicData,
	CodeBlockLayoutContribution,
	EditorDirectiveDefinition,
	State,
} from '@8f4e/editor-state-types';
import gapCalculator from '../../text-geometry/gapCalculator';
import { deriveDirectiveState } from '../features/directives/registry';
import gaps from '../gaps';
import getCodeBlockGridWidth from '../getCodeBlockGridWidth';
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
	block.isHome = directiveState.blockState.isHome;
	block.homeAlignment = directiveState.blockState.homeAlignment;
	block.lineNumberColumnWidth = block.code.length.toString().length;
	block.isCollapsed = displayModel.isCollapsed;
	const draft: BlockLayoutDraft = {
		displayModel,
		verticalSpaceAfterSourceLine: [...contribution.verticalSpaceAfterSourceLine],
	};
	block.minGridWidth = contribution.minGridWidth;
	gaps(block, draft);
	block.width = getCodeBlockGridWidth(block.code, block.minGridWidth) * state.viewport.vGrid;
	const gapRows = [...block.gaps.values()].reduce((total, gap) => total + gap.size, 0);
	block.height = (displayModel.lines.length + gapRows) * state.viewport.hGrid;
	const displayRow = displayModel.sourceLineIndexToDisplayRow[block.cursor.row] ?? block.cursor.row;
	block.cursor.y = gapCalculator(displayRow, block.gaps) * state.viewport.hGrid;
	const previousAlwaysOnTop = Boolean(block.alwaysOnTop);
	block.viewportAnchor = directiveState.blockState.viewportAnchor;
	block.alwaysOnTop = directiveState.blockState.alwaysOnTop ?? false;
	return block.alwaysOnTop !== previousAlwaysOnTop;
}
