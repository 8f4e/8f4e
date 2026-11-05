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
import gapCalculator from '../text-geometry/gapCalculator';
import reverseGapCalculator from '../text-geometry/reverseGapCalculator';
import { getRawIndexForVisualColumn, getTabStopsByLine } from '../text-geometry/tabLayout';
import { stopViewportAnimation } from '../viewport/animateViewport';
import getProjectViewportPosition from '../viewport/getProjectViewportPosition';
import updateViewport from '../viewport/updateViewport';
import { deriveDirectiveState } from './features/directives/registry';
import gaps from './gaps';
import getCodeBlockGridWidth from './getCodeBlockGridWidth';
import type { LayoutRegistry } from './layout/registry';
import type { BlockLayoutDraft } from './layout/types';
import { partitionCodeBlocksByAlwaysOnTop } from './partitionCodeBlocksByAlwaysOnTop';
import { reconstructProject } from './reconstructProject';
import replaceCodeBlocksInPlace from './replaceCodeBlocksInPlace';
import { refreshBlockSources } from './sourceUpdates';

export default function codeBlockRendering(
	store: StateManager<State>,
	events: EventDispatcher,
	directives: EditorDirectiveDefinition[],
	layout: LayoutRegistry
) {
	const state = store.getState();
	const shouldExpandCodeBlockForEditing = (codeBlock: CodeBlockGraphicData): boolean =>
		codeBlock === state.codeBlockRendering.selectedCodeBlock;

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

	const calculateBlockLayout = (graphicData: CodeBlockGraphicData) => {
		const directiveState = deriveDirectiveState(
			graphicData.code,
			graphicData.parsedDirectives,
			{
				isExpandedForEditing: shouldExpandCodeBlockForEditing(graphicData),
			},
			directives
		);
		const displayModel = directiveState.displayModel;
		graphicData.displayModel = displayModel;

		graphicData.disabled = directiveState.blockState.disabled;
		graphicData.isHome = directiveState.blockState.isHome;
		graphicData.homeAlignment = directiveState.blockState.homeAlignment;

		graphicData.lineNumberColumnWidth = graphicData.code.length.toString().length;

		graphicData.isCollapsed = displayModel.isCollapsed;

		const contribution = layout.getContribution(graphicData);
		const blockLayout: BlockLayoutDraft = {
			displayModel,
			verticalSpaceAfterSourceLine: [...contribution.verticalSpaceAfterSourceLine],
		};
		graphicData.minGridWidth = contribution.minGridWidth;
		gaps(graphicData, blockLayout);

		graphicData.width = getCodeBlockGridWidth(graphicData.code, graphicData.minGridWidth) * state.viewport.vGrid;

		const gapRowCount = [...graphicData.gaps.values()].reduce((total, gap) => total + gap.size, 0);
		graphicData.height = (displayModel.lines.length + gapRowCount) * state.viewport.hGrid;
		const displayRow = displayModel.sourceLineIndexToDisplayRow[graphicData.cursor.row] ?? graphicData.cursor.row;
		graphicData.cursor.y = gapCalculator(displayRow, graphicData.gaps) * state.viewport.hGrid;
		const previousAlwaysOnTop = Boolean(graphicData.alwaysOnTop);
		graphicData.viewportAnchor = directiveState.blockState.viewportAnchor;
		graphicData.alwaysOnTop = directiveState.blockState.alwaysOnTop ?? false;
		return graphicData.alwaysOnTop !== previousAlwaysOnTop;
	};

	const repartitionRenderedCodeBlocks = () => {
		replaceCodeBlocksInPlace(
			state.codeBlockRendering.currentProject.blocks,
			partitionCodeBlocksByAlwaysOnTop(state.codeBlockRendering.currentProject.blocks)
		);
	};

	const pendingLayouts = new Set<CodeBlockGraphicData>();
	let calculatingLayouts = false;
	const refreshBlockLayouts = (blocks: readonly CodeBlockGraphicData[]) => {
		for (const block of blocks) pendingLayouts.add(block);
		if (calculatingLayouts) return;
		calculatingLayouts = true;
		let alwaysOnTopChanged = false;
		try {
			while (pendingLayouts.size) {
				const block = pendingLayouts.values().next().value!;
				pendingLayouts.delete(block);
				alwaysOnTopChanged = calculateBlockLayout(block) || alwaysOnTopChanged;
				layout.publish({ codeBlock: block, state });
			}
		} finally {
			calculatingLayouts = false;
		}
		if (alwaysOnTopChanged) repartitionRenderedCodeBlocks();
		events.dispatch('codeBlockLayoutsChanged');
	};

	const updateAllBlockDerivedState = () => {
		refreshBlockLayouts(state.codeBlockRendering.currentProject.blocks);
	};

	const updateAllBlockSources = () => {
		refreshBlockSources(store, state.codeBlockRendering.currentProject.blocks, updateAllBlockDerivedState);
	};

	const recomputePixelCoordinatesAndBlockDerivedState = () => {
		for (const codeBlock of state.codeBlockRendering.currentProject.blocks) {
			if (!codeBlock.viewportAnchor) {
				codeBlock.x = codeBlock.gridX * state.viewport.vGrid;
				codeBlock.y = codeBlock.gridY * state.viewport.hGrid;
			}
		}
		refreshBlockLayouts(state.codeBlockRendering.currentProject.blocks);
	};

	const updateEditedCodeBlock = (block: CodeBlockGraphicData | undefined) => {
		if (!block) return;
		refreshBlockLayouts([block]);
		if (!block.viewportAnchor) {
			block.x = block.gridX * state.viewport.vGrid;
			block.y = block.gridY * state.viewport.hGrid;
		}
	};

	const updateSelectedCodeBlock = () => {
		updateEditedCodeBlock(state.codeBlockRendering.selectedCodeBlock);
	};

	const updateSelectedCodeBlockSource = () => {
		const block = state.codeBlockRendering.selectedCodeBlock;
		if (block) refreshBlockSources(store, [block], () => updateEditedCodeBlock(block));
	};

	const updateProgrammaticSelectedCodeBlock = () => {
		const block = state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit;
		if (block) refreshBlockSources(store, [block], () => updateEditedCodeBlock(block));
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
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', undefined);
		state.codeBlockRendering.nextCodeBlockCreationIndex = nextCodeBlockCreationIndex;
		stopViewportAnimation(state);
		store.set('codeBlockRendering.rootProject', rootProject);
		store.set('codeBlockRendering.currentProject', currentProject);
		store.set('codeBlockRendering.selectedCodeBlock', currentProject.selectedBlock);
		const { x, y } = getProjectViewportPosition(currentProject, state.viewport);
		updateViewport(state, x, y, events);
		incrementCompilerInputRevision(store);
	};

	updateAllBlockSources();

	events.on<CodeBlockPointerDownEvent>('codeBlockPointerDown', onCodeBlockPointerDown);
	events.on<CodeBlockPointerDownEvent>('codeBlockPointerDown', ({ codeBlock }) => refreshBlockLayouts([codeBlock]));
	events.on('memoryValuesChanged', updateAllBlockDerivedState);
	events.on('codeBlockLayoutContributionsChanged', ({ codeBlock }: { codeBlock?: CodeBlockGraphicData }) => {
		if (codeBlock) {
			if (state.codeBlockRendering.currentProject.blocks.includes(codeBlock)) refreshBlockLayouts([codeBlock]);
		} else updateAllBlockDerivedState();
	});
	events.on('gridSizeChanged', recomputePixelCoordinatesAndBlockDerivedState);
	store.subscribe('compiler.isCompiling', updateAllBlockDerivedState);
	store.subscribe('initialProjectState', populateCodeBlocks);
	store.subscribe('codeBlockRendering.currentProject.blocks', updateAllBlockSources);
	store.subscribe('editorConfigSchemaContributions', () => {
		resolveEditorConfig(store);
		updateAllBlockDerivedState();
	});
	store.subscribe('codeBlockRendering.selectedCodeBlock', onSelectedCodeBlockChanged);
	store.subscribe('codeBlockRendering.selectedCodeBlock.code', updateSelectedCodeBlockSource);
	store.subscribe('codeBlockRendering.selectedCodeBlock.cursor', updateSelectedCodeBlock);
	store.subscribe('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', updateProgrammaticSelectedCodeBlock);
}
