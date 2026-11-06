import type {
	CodeBlockGraphicData,
	CodeBlockPointerDownEvent,
	EditorDirectiveDefinition,
	EventDispatcher,
	State,
} from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import resolveEditorConfig from '../global-editor-directives/resolve';
import incrementCompilerInputRevision from '../program-compiler/incrementCompilerInputRevision';
import { isRestoringProjectEdit } from '../project-changes';
import { clampSourcePosition } from '../text-geometry/clampSourcePosition';
import reverseGapCalculator from '../text-geometry/reverseGapCalculator';
import { getRawIndexForVisualColumn, getTabStopsByLine } from '../text-geometry/tabLayout';
import { stopViewportAnimation } from '../viewport/animateViewport';
import getProjectViewportPosition from '../viewport/getProjectViewportPosition';
import updateViewport from '../viewport/updateViewport';
import { deriveDirectiveState } from './features/directives/registry';
import { createLayoutCoordinator } from './layout/coordinator';
import type { LayoutRegistry } from './layout/registry';
import { reconstructProject } from './reconstructProject';
import { refreshBlockSources } from './sourceUpdates';

export default function codeBlockRendering(
	store: StateManager<State>,
	events: EventDispatcher,
	directives: EditorDirectiveDefinition[],
	layout: LayoutRegistry
) {
	const state = store.getState();
	const coordinator = createLayoutCoordinator(state, events, directives, layout);
	const refreshBlockLayouts = coordinator.refreshBlocks;

	const onCodeBlockPointerDown = ({ relativeX = 0, relativeY = 0, codeBlock }: CodeBlockPointerDownEvent) => {
		if (!state.featureFlags.codeLineSelection) {
			return;
		}

		const directiveState = deriveDirectiveState(
			codeBlock.code,
			codeBlock.parsedDirectives,
			{
				isExpandedForEditing: !codeBlock.isCollapsed,
			},
			directives
		);
		const displayModel = directiveState.displayModel;
		const displayRow = reverseGapCalculator(Math.floor(relativeY / state.viewport.hGrid), codeBlock.gaps);
		const row =
			displayModel.displayRowToSourceLineIndex[
				Math.min(displayRow, displayModel.displayRowToSourceLineIndex.length - 1)
			] ?? 0;
		const visualCol = Math.max(Math.floor(relativeX / state.viewport.vGrid) - (codeBlock.lineNumberColumnWidth + 2), 0);
		const tabStopsByLine = getTabStopsByLine(codeBlock.code);
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

	const refreshCurrentProjectSources = () => {
		coordinator.syncProject(state.codeBlockRendering.currentProject);
		refreshBlockSources(store, events, state.codeBlockRendering.currentProject.blocks, refreshCurrentProjectLayout);
	};

	const updateEditedCodeBlock = (block: CodeBlockGraphicData | undefined) => {
		if (!block) return;
		refreshBlockLayouts([block]);
	};

	const updateSelectedCodeBlock = () => {
		updateEditedCodeBlock(state.codeBlockRendering.selectedCodeBlock);
	};

	const updateSelectedCodeBlockSource = () => {
		const block = state.codeBlockRendering.selectedCodeBlock;
		if (block) refreshBlockSources(store, events, [block], () => updateEditedCodeBlock(block));
	};

	const onSourcesChanged = ({ codeBlocks }: { codeBlocks: readonly CodeBlockGraphicData[] }) => {
		refreshBlockSources(store, events, codeBlocks, () => refreshBlockLayouts(codeBlocks));
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

	const populateCodeBlocks = () => {
		if (!state.initialProjectState) {
			return;
		}

		state.codeBlockRendering.draggedCodeBlock = undefined;
		const sameProject = isRestoringProjectEdit(state);
		const { rootProject, currentProject, nextCodeBlockCreationIndex } = reconstructProject(
			state.initialProjectState,
			directives,
			state.viewport,
			sameProject ? state.codeBlockRendering : undefined
		);
		store.set('codeBlockRendering.selectedCodeBlock', undefined);
		state.codeBlockRendering.nextCodeBlockCreationIndex = nextCodeBlockCreationIndex;
		stopViewportAnimation(state);
		coordinator.reset(rootProject);
		store.set('codeBlockRendering.rootProject', rootProject);
		store.set('codeBlockRendering.currentProject', currentProject);
		store.set('codeBlockRendering.selectedCodeBlock', currentProject.selectedBlock);
		const { x, y } = getProjectViewportPosition(currentProject, state.viewport);
		updateViewport(state, x, y, events);
		incrementCompilerInputRevision(store);
	};

	refreshCurrentProjectSources();

	events.on('codeBlockPointerDown', onCodeBlockPointerDown);
	events.on('codeBlockPointerDown', ({ codeBlock }: CodeBlockPointerDownEvent) => refreshBlockLayouts([codeBlock]));
	events.on('memoryValuesChanged', refreshCurrentProjectLayout);
	events.on('codeBlockSourcesChanged', onSourcesChanged);
	events.on('codeBlockLayoutContributionsChanged', ({ codeBlock }: { codeBlock?: CodeBlockGraphicData }) => {
		if (codeBlock) {
			refreshBlockLayouts([codeBlock]);
		} else refreshCurrentProjectLayout();
	});
	events.on('gridSizeChanged', refreshCurrentProjectLayout);
	store.subscribe('compiler.isCompiling', refreshCurrentProjectLayout);
	store.subscribe('initialProjectState', populateCodeBlocks);
	store.subscribe('codeBlockRendering.currentProject.blocks', refreshCurrentProjectSources);
	store.subscribe('editorConfigSchemaContributions', () => {
		resolveEditorConfig(store);
		refreshCurrentProjectLayout();
	});
	store.subscribe('codeBlockRendering.selectedCodeBlock', onSelectedCodeBlockChanged);
	store.subscribe('codeBlockRendering.selectedCodeBlock.code', updateSelectedCodeBlockSource);
	store.subscribe('codeBlockRendering.selectedCodeBlock.cursor', updateSelectedCodeBlock);
	return coordinator.dispose;
}
