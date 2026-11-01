import type {
	CodeBlockGraphicData,
	EditorDirectiveDefinition,
	EventDispatcher,
	ProjectLevel,
	State,
} from '@8f4e/editor-state-types';
import {
	createChildProjectGroupPath,
	type ProjectBlock,
	type ProjectGroupPath,
	type ProjectObjectModel,
	ROOT_PROJECT_GROUP_PATH,
} from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { findProjectLevel, walkProjectLevels } from '../../pureHelpers/projectTree';
import gapCalculator from '../code-editing/gapCalculator';
import { moveCaret } from '../code-editing/moveCaret';
import reverseGapCalculator from '../code-editing/reverseGapCalculator';
import { getRawIndexForVisualColumn, getTabStopsByLine, getVisualColumnForRawIndex } from '../code-editing/tabLayout';
import resolveEditorConfig from '../global-editor-directives/resolve';
import incrementCompilerInputRevision from '../program-compiler/incrementCompilerInputRevision';
import { isRestoringProjectEdit } from '../project-changes';
import { stopViewportAnimation } from '../viewport/animateViewport';
import getProjectViewportPosition from '../viewport/getProjectViewportPosition';
import updateViewport from '../viewport/updateViewport';
import deriveErrorMessages from './deriveErrorMessages';
import blockHighlights from './features/blockHighlights/updateGraphicData';
import type { CodeBlockPointerDownEvent } from './features/codeBlockDragger/effect';
import parsePos from './features/directives/pos/data';
import { deriveDirectiveState } from './features/directives/registry';
import gaps from './gaps';
import getCodeBlockGridWidth from './getCodeBlockGridWidth';
import type { LayoutRegistry } from './layout/registry';
import type { BlockLayoutDraft } from './layout/types';
import paramShape, { updateParamShapeDeclarations } from './paramShape/updateGraphicData';
import { partitionCodeBlocksByAlwaysOnTop } from './partitionCodeBlocksByAlwaysOnTop';
import replaceCodeBlocksInPlace from './replaceCodeBlocksInPlace';
import shape, { updateShapeDeclarations } from './shape/updateGraphicData';
import { refreshBlockSources } from './sourceUpdates';
import { createCodeBlockGraphicData } from './utils/createCodeBlockGraphicData';
import getCodeBlockNameFromSource from './utils/getCodeBlockNameFromSource';
import { parseBlockDirectives } from './utils/parseBlockDirectives';

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
		const [boundedRow, boundedCol] = moveCaret(codeBlock.code, row, col, 'jump');
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
		const tabStopsByLine = getTabStopsByLine(graphicData.code);

		graphicData.lineNumberColumnWidth = graphicData.code.length.toString().length;

		graphicData.isCollapsed = displayModel.isCollapsed;

		const contribution = layout.getContribution(graphicData);
		const blockLayout: BlockLayoutDraft = {
			displayModel,
			verticalSpaceAfterSourceLine: [...contribution.verticalSpaceAfterSourceLine],
		};
		graphicData.minGridWidth = contribution.minGridWidth;
		shape(graphicData, state, blockLayout);
		paramShape(graphicData, state, blockLayout);
		graphicData.widgets.errorMessages = deriveErrorMessages(graphicData, state);
		gaps(graphicData, blockLayout);
		for (const error of graphicData.widgets.errorMessages) {
			const displayRow = displayModel.sourceLineIndexToDisplayRow[error.lineNumber] ?? error.lineNumber;
			error.y = (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid;
		}
		updateShapeDeclarations(graphicData, state, blockLayout);
		updateParamShapeDeclarations(graphicData, state, blockLayout);

		graphicData.width = getCodeBlockGridWidth(graphicData.code, graphicData.minGridWidth) * state.viewport.vGrid;

		blockHighlights(graphicData, state);

		const gapRowCount = [...graphicData.gaps.values()].reduce((total, gap) => total + gap.size, 0);
		graphicData.height = (displayModel.lines.length + gapRowCount) * state.viewport.hGrid;
		graphicData.cursor.x =
			(getVisualColumnForRawIndex(
				graphicData.code[graphicData.cursor.row] || '',
				graphicData.cursor.col,
				tabStopsByLine[graphicData.cursor.row] || []
			) +
				(graphicData.lineNumberColumnWidth + 2)) *
			state.viewport.vGrid;
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
		const previousCurrent = state.codeBlockRendering.currentProject;
		const previousLevels = new Map<string, ProjectLevel>();
		const previousBlocks = new Map<string, CodeBlockGraphicData>();
		const previousGroups = new Map<string, CodeBlockGraphicData>();
		if (sameProject) {
			previousCurrent.viewport = { x: state.viewport.x, y: state.viewport.y };
			for (const level of walkProjectLevels(state.codeBlockRendering.rootProject)) {
				previousLevels.set(level.path, level);
				for (const block of level.blocks) {
					if (block.childProject) previousGroups.set(block.childProject.path, block);
					else {
						const key = block.isProjectScope
							? 'project-scope'
							: JSON.stringify([block.projectPath, block.creationIndex]);
						previousBlocks.set(key, block);
					}
				}
			}
		}
		const project = state.initialProjectState;
		type ClassifiedProjectBlock = ProjectBlock & {
			blockType: CodeBlockGraphicData['blockType'];
			entry?: string;
		};
		const collectProjectBlocks = (currentProject: ProjectObjectModel): ClassifiedProjectBlock[] => {
			return [
				...currentProject.functions.map(block => ({ ...block, blockType: 'function' as const })),
				...currentProject.constants.map(block => ({ ...block, blockType: 'constants' as const })),
				...currentProject.prototypes.map(block => ({ ...block, blockType: 'prototype' as const })),
				...currentProject.includes.map(block => ({ ...block, blockType: 'includes' as const })),
				...currentProject.notes.map(block => ({ ...block, blockType: 'note' as const })),
				...currentProject.unknown.map(block => ({ ...block, blockType: 'unknown' as const })),
			];
		};
		const getHighestProjectBlockId = (currentProject: ProjectObjectModel): number =>
			Math.max(
				-1,
				...collectProjectBlocks(currentProject).map(block => block.id),
				...currentProject.execution.map(block =>
					block.type === 'group' ? Math.max(block.id, getHighestProjectBlockId(block)) : block.id
				)
			);
		let nextCodeBlockCreationIndex = getHighestProjectBlockId(project) + 1;
		store.set('codeBlockRendering.selectedCodeBlock', undefined);
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', undefined);

		const createGraphicCodeBlock = (
			codeBlock: ClassifiedProjectBlock,
			overrides: Partial<CodeBlockGraphicData> = {}
		): CodeBlockGraphicData => {
			// Same-project edits retain an existing position while their source is incomplete.
			const projectPath = overrides.projectPath ?? ROOT_PROJECT_GROUP_PATH;
			const name = overrides.name ?? getCodeBlockNameFromSource(codeBlock.code);
			const previousBlock =
				overrides.childProject !== undefined
					? previousGroups.get(createChildProjectGroupPath(projectPath, name))
					: previousBlocks.get(
							overrides.isProjectScope ? 'project-scope' : JSON.stringify([projectPath, codeBlock.id])
						);
			const blockParsedDirectives = parseBlockDirectives(codeBlock.code);
			const posResult = parsePos(blockParsedDirectives);
			const gridX = posResult ? posResult.x : previousBlock ? previousBlock.gridX : 0;
			const gridY = posResult ? posResult.y : previousBlock ? previousBlock.gridY : 0;
			const directiveState = deriveDirectiveState(codeBlock.code, blockParsedDirectives, {}, directives);

			// For viewport-anchored blocks, x/y will be resolved after block derivation sets
			// width/height; initialize to 0 here as a safe placeholder.
			const isAnchored = directiveState.blockState.viewportAnchor !== undefined;
			const pixelX = isAnchored ? 0 : gridX * state.viewport.vGrid;
			const pixelY = isAnchored ? 0 : gridY * state.viewport.hGrid;

			return createCodeBlockGraphicData({
				width: 0,
				height: 0,
				code: codeBlock.code,
				cursor: { col: 0, row: 0, x: 0, y: 0 },
				name,
				gridX,
				gridY,
				x: pixelX,
				y: pixelY,
				lineNumberColumnWidth: 1,
				creationIndex: codeBlock.id,
				blockType: codeBlock.blockType,
				entry: codeBlock.entry,
				disabled: codeBlock.disabled ?? directiveState.blockState.disabled,
				isHome: directiveState.blockState.isHome,
				homeAlignment: directiveState.blockState.homeAlignment,
				alwaysOnTop: directiveState.blockState.alwaysOnTop ?? false,
				viewportAnchor: directiveState.blockState.viewportAnchor,
				parsedDirectives: blockParsedDirectives,
				...overrides,
			});
		};
		const createProjectLevel = (currentProject: ProjectObjectModel, projectPath: ProjectGroupPath): ProjectLevel => {
			const projectScopeBlocks =
				projectPath === ROOT_PROJECT_GROUP_PATH && currentProject.code.length > 0
					? [
							createGraphicCodeBlock(
								{
									id: nextCodeBlockCreationIndex++,
									code: currentProject.code,
									blockType: 'unknown',
								},
								{ projectPath, isProjectScope: true }
							),
						]
					: [];
			const codeBlocks = collectProjectBlocks(currentProject).map(codeBlock =>
				createGraphicCodeBlock(codeBlock, { projectPath })
			);
			const executionBlocks = currentProject.execution.map(block => {
				if (block.type === 'module') {
					return createGraphicCodeBlock({ ...block, blockType: 'module' }, { projectPath });
				}
				const group = block;
				const groupName = group.name;
				return createGraphicCodeBlock(
					{
						id: group.id,
						code: [...group.code],
						blockType: 'unknown',
						entry: group.entry,
					},
					{
						name: groupName,
						projectPath,
						childProject: createProjectLevel(group, createChildProjectGroupPath(projectPath, groupName)),
					}
				);
			});
			const projectCodeBlocks = [...projectScopeBlocks, ...codeBlocks, ...executionBlocks];

			// Stable-sort to maintain the partition: normal blocks first, always-on-top last.
			return {
				path: projectPath,
				blocks: partitionCodeBlocksByAlwaysOnTop(projectCodeBlocks),
				viewport: previousLevels.get(projectPath)?.viewport,
			};
		};
		const rootProject = createProjectLevel(project, ROOT_PROJECT_GROUP_PATH);
		const currentProject = (sameProject && findProjectLevel(rootProject, previousCurrent.path)) || rootProject;
		state.codeBlockRendering.nextCodeBlockCreationIndex = nextCodeBlockCreationIndex;
		stopViewportAnimation(state);
		store.set('codeBlockRendering.rootProject', rootProject);
		store.set('codeBlockRendering.currentProject', currentProject);
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
	events.on('spriteSheetRerendered', recomputePixelCoordinatesAndBlockDerivedState);
	store.subscribe('codeErrors', updateAllBlockDerivedState);
	store.subscribe('assertionResults', updateAllBlockDerivedState);
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
