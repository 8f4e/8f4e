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
import { getRawIndexForVisualColumn } from '../text-geometry/tabLayout';
import { normalizeEnvironmentBlockSources } from './features/auto-env-constants/source';
import { createLayoutCoordinator } from './layout/coordinator';
import type { LayoutRegistry } from './layout/registry';
import { createProjectMembership } from './projectMembership';
import { reconstructProject } from './reconstructProject';
import { prepareProjectSources, refreshBlockSources } from './sourceUpdates';
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

	// Reconstruction prepares an entire tree before attaching it, so its membership is already known.
	let reconstructedSources = false;
	const onCurrentProjectBlocksChanged = () => {
		const project = state.codeBlockRendering.currentProject;
		const addedBlocks = membership.syncProject(project);
		const needsConfigRefresh = reconstructedSources || addedBlocks !== undefined;
		reconstructedSources = false;
		if (addedBlocks !== undefined) {
			normalizeEnvironmentBlockSources(state, addedBlocks);
			prepareProjectSources(project, addedBlocks, directives);
		}
		if (needsConfigRefresh) resolveEditorConfig(store);
		refreshCurrentProjectLayout();
	};

	const updateSelectedCodeBlock = () => {
		const block = state.codeBlockRendering.selectedCodeBlock;
		if (block) updateCursorY(block, state.viewport.hGrid);
	};

	const onSourcesChanged = ({ codeBlocks }: { codeBlocks: readonly CodeBlockGraphicData[] }) => {
		normalizeEnvironmentBlockSources(state, codeBlocks);
		refreshBlockSources(codeBlocks, directives, membership);
		resolveEditorConfig(store);
		refreshBlockLayouts(codeBlocks);
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
		membership.reset(rootProject);
		coordinator.clearPending();
		store.set('codeBlockRendering.rootProject', rootProject);
		reconstructedSources = true;
		store.set('codeBlockRendering.currentProject', currentProject);
		store.set('codeBlockRendering.selectedCodeBlock', currentProject.selectedBlock);
		incrementCompilerInputRevision(store);
	};

	const rootProject = state.codeBlockRendering.rootProject;
	normalizeEnvironmentBlockSources(state, rootProject.blocks);
	prepareProjectSources(rootProject, rootProject.blocks, directives);
	resolveEditorConfig(store);
	refreshCurrentProjectLayout();

	events.on('codeBlockPointerDown', onCodeBlockPointerDown);
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
	store.subscribe('codeBlockRendering.currentProject.blocks', onCurrentProjectBlocksChanged);
	store.subscribe('editorConfigSchemaContributions', () => {
		resolveEditorConfig(store);
		refreshCurrentProjectLayout();
	});
	store.subscribe('codeBlockRendering.selectedCodeBlock', onSelectedCodeBlockChanged);
	store.subscribe('codeBlockRendering.selectedCodeBlock.cursor', updateSelectedCodeBlock);
}
