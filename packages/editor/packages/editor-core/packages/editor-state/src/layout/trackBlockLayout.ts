import type { CodeBlockPointerDownEvent, EditorCodeBlock, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import type { LayoutCoordinator } from './blockLayoutCoordinator';
import { clampSourcePosition } from './text-geometry/clampSourcePosition';
import gridRowToDisplayRow from './text-geometry/gridRowToDisplayRow';
import { getRawIndexForVisualColumn } from './text-geometry/tabLayout';
import { updateCursorY } from './updateCursorY';

export default function trackBlockLayout(
	store: StateManager<State>,
	events: EventDispatcher,
	coordinator: LayoutCoordinator
): () => void {
	const state = store.getState();
	const refreshBlockLayouts = coordinator.refreshBlocks;

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

	const refreshCurrentProjectLayout = () => {
		coordinator.refreshProject(state.project.activeLevel);
	};

	// Membership and source preparation belong exclusively to the project transaction service.
	// Selecting an already-owned level simply refreshes its visible geometry.
	let previousProject = state.project.activeLevel;
	const onCurrentProjectChanged = () => {
		const project = state.project.activeLevel;
		if (project !== previousProject) {
			previousProject = project;
			refreshCurrentProjectLayout();
		}
	};

	const updateSelectedCodeBlock = () => {
		const block = state.project.selectedCodeBlock;
		if (block) updateCursorY(block, state.viewport.hGrid);
	};

	const updateHideSelectionTransition = (
		previousBlock: EditorCodeBlock | undefined,
		nextBlock: EditorCodeBlock | undefined
	) => {
		refreshBlockLayouts([previousBlock, nextBlock].filter((block): block is EditorCodeBlock => block !== undefined));
	};

	let previousSelectedCodeBlock = state.project.selectedCodeBlock;
	const onSelectedCodeBlockChanged = () => {
		if (previousSelectedCodeBlock === state.project.selectedCodeBlock) return;
		updateHideSelectionTransition(previousSelectedCodeBlock, state.project.selectedCodeBlock);
		previousSelectedCodeBlock = state.project.selectedCodeBlock;
	};

	const onLayoutContributionsChanged = ({ codeBlock }: { codeBlock?: EditorCodeBlock }) => {
		if (codeBlock) {
			refreshBlockLayouts([codeBlock]);
		} else refreshCurrentProjectLayout();
	};

	events.on('codeBlockPointerDown', onCodeBlockPointerDown);
	events.on('codeBlockLayoutContributionsChanged', onLayoutContributionsChanged);
	events.on('gridSizeChanged', refreshCurrentProjectLayout);
	store.subscribe('project.activeLevel', onCurrentProjectChanged);
	store.subscribe('project.selectedCodeBlock', onSelectedCodeBlockChanged);
	store.subscribe('project.selectedCodeBlock.cursor', updateSelectedCodeBlock);
	return () => {
		events.off('codeBlockPointerDown', onCodeBlockPointerDown);
		events.off('codeBlockLayoutContributionsChanged', onLayoutContributionsChanged);
		events.off('gridSizeChanged', refreshCurrentProjectLayout);
		store.unsubscribe('project.activeLevel', onCurrentProjectChanged);
		store.unsubscribe('project.selectedCodeBlock', onSelectedCodeBlockChanged);
		store.unsubscribe('project.selectedCodeBlock.cursor', updateSelectedCodeBlock);
	};
}
