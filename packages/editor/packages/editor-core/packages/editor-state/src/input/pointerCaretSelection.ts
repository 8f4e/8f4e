import type { CodeBlockPointerDownEvent, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { clampSourcePosition } from '../layout/text-geometry/clampSourcePosition';
import gridRowToDisplayRow from '../layout/text-geometry/gridRowToDisplayRow';
import { getRawIndexForVisualColumn } from '../layout/text-geometry/tabLayout';

/** Maps pointer presses to the selected block's source row and column. */
export default function registerPointerCaretSelection(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();
	const onCodeBlockPointerDown = ({ relativeX = 0, relativeY = 0, codeBlock }: CodeBlockPointerDownEvent) => {
		if (!state.featureFlags.codeLineSelection) {
			return;
		}

		const displayModel = codeBlock.displayModel;
		const displayRow = gridRowToDisplayRow(Math.floor(relativeY / state.viewport.hGrid), codeBlock.gaps);
		const row =
			displayModel.displayRowToSourceLineIndex[
				Math.min(displayRow, displayModel.displayRowToSourceLineIndex.length - 1)
			] ?? 0;
		const visualCol = Math.max(Math.floor(relativeX / state.viewport.vGrid) - (codeBlock.lineNumberColumnWidth + 2), 0);
		const tabStopsByLine = codeBlock.tabStopsByLine;
		const col = getRawIndexForVisualColumn(
			codeBlock.code[Math.min(row, codeBlock.code.length - 1)] || '',
			visualCol,
			tabStopsByLine[Math.min(row, codeBlock.code.length - 1)] || []
		);
		const [boundedRow, boundedCol] = clampSourcePosition(codeBlock.code, row, col);
		if (codeBlock !== state.project.selectedCodeBlock) {
			return;
		}

		store.set('project.selectedCodeBlock.cursor', {
			...codeBlock.cursor,
			row: boundedRow,
			col: boundedCol,
		});
	};

	events.on('codeBlockPointerDown', onCodeBlockPointerDown);
	return () => events.off('codeBlockPointerDown', onCodeBlockPointerDown);
}
