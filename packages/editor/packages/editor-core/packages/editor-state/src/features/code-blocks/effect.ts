import type {
	CodeBlockGraphicData,
	CodeBlockPointerDownEvent,
	EditorDirectiveDefinition,
	EventDispatcher,
	State,
} from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { createProjectEditService } from '../project-edits/service';
import { clampSourcePosition } from '../text-geometry/clampSourcePosition';
import reverseGapCalculator from '../text-geometry/reverseGapCalculator';
import { getRawIndexForVisualColumn } from '../text-geometry/tabLayout';
import { createLayoutCoordinator } from './layout/coordinator';
import type { LayoutRegistry } from './layout/registry';
import { createProjectMembership } from './projectMembership';
import { updateCursorY } from './updateCursorY';

export default function codeBlockRendering(
	store: StateManager<State>,
	events: EventDispatcher,
	directives: EditorDirectiveDefinition[],
	layout: LayoutRegistry
) {
	const state = store.getState();
	const membership = createProjectMembership(state.codeBlockRendering.rootProject);
	const coordinator = createLayoutCoordinator(state, events, layout, membership);
	const refreshBlockLayouts = coordinator.refreshBlocks;

	const onCodeBlockPointerDown = ({ relativeX = 0, relativeY = 0, codeBlock }: CodeBlockPointerDownEvent) => {
		if (!state.featureFlags.codeLineSelection) {
			return;
		}

		const displayModel = codeBlock.displayModel;
		const displayRow = reverseGapCalculator(Math.floor(relativeY / state.viewport.hGrid), codeBlock.gaps);
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
		if (codeBlock !== state.codeBlockRendering.selectedCodeBlock) {
			return;
		}

		store.set('codeBlockRendering.selectedCodeBlock.cursor', {
			...codeBlock.cursor,
			row: boundedRow,
			col: boundedCol,
		});
	};

	const refreshCurrentProjectLayout = () => {
		coordinator.refreshProject(state.codeBlockRendering.currentProject);
	};

	// Membership and source preparation belong exclusively to the project-edit service.
	// Selecting an already-owned level simply refreshes its visible geometry.
	let previousProject = state.codeBlockRendering.currentProject;
	const onCurrentProjectBlocksChanged = () => {
		const project = state.codeBlockRendering.currentProject;
		if (project !== previousProject) {
			previousProject = project;
			refreshCurrentProjectLayout();
		}
	};

	const updateSelectedCodeBlock = () => {
		const block = state.codeBlockRendering.selectedCodeBlock;
		if (block) updateCursorY(block, state.viewport.hGrid);
	};

	const updateHideSelectionTransition = (
		previousBlock: CodeBlockGraphicData | undefined,
		nextBlock: CodeBlockGraphicData | undefined
	) => {
		refreshBlockLayouts(
			[previousBlock, nextBlock].filter((block): block is CodeBlockGraphicData => block !== undefined)
		);
	};

	let previousSelectedCodeBlock = state.codeBlockRendering.selectedCodeBlock;
	const onSelectedCodeBlockChanged = () => {
		if (previousSelectedCodeBlock === state.codeBlockRendering.selectedCodeBlock) return;
		updateHideSelectionTransition(previousSelectedCodeBlock, state.codeBlockRendering.selectedCodeBlock);
		previousSelectedCodeBlock = state.codeBlockRendering.selectedCodeBlock;
	};

	const projectEdits = createProjectEditService(store, events, directives, membership, coordinator);

	events.on('codeBlockPointerDown', onCodeBlockPointerDown);
	events.on('memoryValuesChanged', refreshCurrentProjectLayout);
	events.on('codeBlockLayoutContributionsChanged', ({ codeBlock }: { codeBlock?: CodeBlockGraphicData }) => {
		if (codeBlock) {
			refreshBlockLayouts([codeBlock]);
		} else refreshCurrentProjectLayout();
	});
	events.on('gridSizeChanged', refreshCurrentProjectLayout);
	store.subscribe('compiler.isCompiling', refreshCurrentProjectLayout);
	store.subscribe('codeBlockRendering.currentProject.blocks', onCurrentProjectBlocksChanged);
	store.subscribe('codeBlockRendering.selectedCodeBlock', onSelectedCodeBlockChanged);
	store.subscribe('codeBlockRendering.selectedCodeBlock.cursor', updateSelectedCodeBlock);
	return projectEdits;
}
