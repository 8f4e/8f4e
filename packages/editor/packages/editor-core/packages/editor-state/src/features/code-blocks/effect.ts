import type { CodeBlockGraphicData, EditorDirectiveDefinition, EventDispatcher, State } from '@8f4e/editor-state-types';
import {
	createChildProjectGroupPath,
	type ProjectBlock,
	type ProjectGroupPath,
	type ProjectObjectModel,
	ROOT_PROJECT_GROUP_PATH,
} from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import gapCalculator from '../code-editing/gapCalculator';
import { moveCaret } from '../code-editing/moveCaret';
import reverseGapCalculator from '../code-editing/reverseGapCalculator';
import { getRawIndexForVisualColumn, getTabStopsByLine, getVisualColumnForRawIndex } from '../code-editing/tabLayout';
import incrementCompilerInputRevision from '../program-compiler/incrementCompilerInputRevision';
import centerViewportOnCodeBlock from '../viewport/centerViewportOnCodeBlock';
import updateViewport from '../viewport/updateViewport';
import deriveErrorMessages from './deriveErrorMessages';
import blockHighlights from './features/blockHighlights/updateGraphicData';
import type { CodeBlockPointerDownEvent } from './features/codeBlockDragger/effect';
import parsePos from './features/directives/pos/data';
import {
	deriveDirectiveState,
	runBeforeGraphicDataWidthCalculation,
	runBlockLayoutReady,
} from './features/directives/registry';
import inputs from './features/inputs/updateGraphicData';
import outputs from './features/outputs/updateGraphicData';
import gaps from './gaps';
import getCodeBlockGridWidth from './getCodeBlockGridWidth';
import paramShape, { updateParamShapeDeclarations } from './paramShape/updateGraphicData';
import { partitionCodeBlocksByAlwaysOnTop } from './partitionCodeBlocksByAlwaysOnTop';
import replaceCodeBlocksInPlace from './replaceCodeBlocksInPlace';
import shape, { updateShapeDeclarations } from './shape/updateGraphicData';
import { createCodeBlockGraphicData } from './utils/createCodeBlockGraphicData';
import getCodeBlockNameFromSource from './utils/getCodeBlockNameFromSource';
import { parseBlockDirectives } from './utils/parseBlockDirectives';

export default function codeBlockRendering(
	store: StateManager<State>,
	events: EventDispatcher,
	directives: EditorDirectiveDefinition[]
) {
	const state = store.getState();
	const updateProjectSliceIdentity = (codeBlocks: CodeBlockGraphicData[], projectPath: ProjectGroupPath): void => {
		for (const codeBlock of codeBlocks) {
			codeBlock.projectPath = projectPath;
			if (codeBlock.nestedProjectCodeBlocks !== undefined) {
				updateProjectSliceIdentity(
					codeBlock.nestedProjectCodeBlocks,
					createChildProjectGroupPath(projectPath, codeBlock.name)
				);
			}
		}
	};
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

	const updateBlockDerivedState = (graphicData: CodeBlockGraphicData) => {
		const directiveState = deriveDirectiveState(
			graphicData.code,
			graphicData.parsedDirectives,
			{
				isExpandedForEditing: shouldExpandCodeBlockForEditing(graphicData),
				state,
			},
			directives
		);
		const displayModel = directiveState.displayModel;
		graphicData.displayModel = displayModel;

		graphicData.disabled = directiveState.blockState.disabled;
		graphicData.isHome = directiveState.blockState.isHome;
		graphicData.homeAlignment = directiveState.blockState.homeAlignment;
		graphicData.isFavorite = directiveState.blockState.isFavorite;
		const tabStopsByLine = getTabStopsByLine(graphicData.code);

		graphicData.lineNumberColumnWidth = graphicData.code.length.toString().length;

		const previousName = graphicData.name;
		graphicData.name = getCodeBlockNameFromSource(graphicData.code);
		if (graphicData.nestedProjectCodeBlocks !== undefined && graphicData.name !== previousName) {
			updateProjectSliceIdentity(
				graphicData.nestedProjectCodeBlocks,
				createChildProjectGroupPath(graphicData.projectPath, graphicData.name)
			);
		}
		graphicData.isCollapsed = displayModel.isCollapsed;

		shape(graphicData, state, directiveState);
		paramShape(graphicData, state, directiveState);
		graphicData.widgets.errorMessages = deriveErrorMessages(graphicData, state);
		gaps(graphicData, directiveState);
		for (const error of graphicData.widgets.errorMessages) {
			const displayRow = displayModel.sourceLineIndexToDisplayRow[error.lineNumber] ?? error.lineNumber;
			error.y = (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid;
		}
		updateShapeDeclarations(graphicData, state, directiveState);
		updateParamShapeDeclarations(graphicData, state, directiveState);
		runBeforeGraphicDataWidthCalculation(graphicData, state, directiveState, directives);

		graphicData.width = getCodeBlockGridWidth(graphicData.code, graphicData.minGridWidth) * state.viewport.vGrid;

		outputs(graphicData, state);
		inputs(graphicData, state);
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
		graphicData.groupName = directiveState.blockState.groupName;
		graphicData.groupNonstick = directiveState.blockState.groupNonstick;
		graphicData.viewportAnchor = directiveState.blockState.viewportAnchor;
		graphicData.alwaysOnTop = directiveState.blockState.alwaysOnTop ?? false;
		runBlockLayoutReady(graphicData, state, directiveState);
		return graphicData.alwaysOnTop !== previousAlwaysOnTop;
	};

	const repartitionRenderedCodeBlocks = () => {
		replaceCodeBlocksInPlace(
			state.codeBlockRendering.codeBlocks,
			partitionCodeBlocksByAlwaysOnTop(state.codeBlockRendering.codeBlocks)
		);
	};

	const updateAllBlockDerivedState = () => {
		state.codeBlockRendering.outputsByWordAddress.clear();
		let alwaysOnTopChanged = false;
		for (const graphicData of state.codeBlockRendering.codeBlocks) {
			if (updateBlockDerivedState(graphicData)) {
				alwaysOnTopChanged = true;
			}
		}
		if (alwaysOnTopChanged) {
			repartitionRenderedCodeBlocks();
		}
	};

	const recomputePixelCoordinatesAndBlockDerivedState = () => {
		// When viewport grid dimensions change (e.g., font change), recompute pixel positions
		// from the stable grid coordinates, then update graphics. Combined into single iteration.
		let alwaysOnTopChanged = false;
		for (const codeBlock of state.codeBlockRendering.codeBlocks) {
			if (!codeBlock.viewportAnchor) {
				// World-space blocks: derive pixel position directly from grid coordinates.
				codeBlock.x = codeBlock.gridX * state.viewport.vGrid;
				codeBlock.y = codeBlock.gridY * state.viewport.hGrid;
			}
			// Viewport-anchored blocks: x/y depend on current block width/height (for right/bottom
			// anchors). Block derivation computes width and height first, then applies the anchored
			// position at the end of its execution. No pre-assignment needed here.
			if (updateBlockDerivedState(codeBlock)) {
				alwaysOnTopChanged = true;
			}
		}
		if (alwaysOnTopChanged) {
			repartitionRenderedCodeBlocks();
		}
	};

	const centerViewportOnSelectedOrHomeCodeBlock = () => {
		const targetCodeBlock =
			state.codeBlockRendering.selectedCodeBlock ?? state.codeBlockRendering.codeBlocks.find(block => block.isHome);
		if (!targetCodeBlock) {
			return;
		}

		const { x, y } = centerViewportOnCodeBlock(state.viewport, targetCodeBlock, {
			alignment: targetCodeBlock.homeAlignment,
		});
		updateViewport(state, x, y, events);
	};

	const updateSelectedCodeBlock = () => {
		if (!state.codeBlockRendering.selectedCodeBlock) {
			return;
		}
		if (updateBlockDerivedState(state.codeBlockRendering.selectedCodeBlock)) {
			repartitionRenderedCodeBlocks();
		}
	};

	const updateProgrammaticSelectedCodeBlock = () => {
		const block = state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit;
		if (!block) {
			return;
		}
		if (updateBlockDerivedState(block)) {
			repartitionRenderedCodeBlocks();
		}
	};

	const updateHideSelectionTransition = (
		previousBlock: CodeBlockGraphicData | undefined,
		nextBlock: CodeBlockGraphicData | undefined
	) => {
		let alwaysOnTopChanged = false;
		[previousBlock, nextBlock].forEach(codeBlock => {
			if (!codeBlock) {
				return;
			}

			if (updateBlockDerivedState(codeBlock)) {
				alwaysOnTopChanged = true;
			}
		});
		if (alwaysOnTopChanged) {
			repartitionRenderedCodeBlocks();
		}
	};

	let previousSelectedCodeBlock = state.codeBlockRendering.selectedCodeBlock;
	const onSelectedCodeBlockChanged = () => {
		updateHideSelectionTransition(previousSelectedCodeBlock, state.codeBlockRendering.selectedCodeBlock);
		previousSelectedCodeBlock = state.codeBlockRendering.selectedCodeBlock;
	};

	const populateCodeBlocks = async () => {
		if (!state.initialProjectState) {
			return;
		}

		state.codeBlockRendering.outputsByWordAddress.clear();
		state.codeBlockRendering.draggedCodeBlock = undefined;
		const project = state.initialProjectState;
		type ClassifiedProjectBlock = ProjectBlock & {
			blockType: CodeBlockGraphicData['blockType'];
			entry?: string;
		};
		const collectProjectBlocks = (currentProject: ProjectObjectModel): ClassifiedProjectBlock[] => {
			return [
				...currentProject.modules.map(block => ({ ...block, blockType: 'module' as const })),
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
				...currentProject.groups.map(getHighestProjectBlockId)
			);
		let nextCodeBlockCreationIndex = getHighestProjectBlockId(project) + 1;
		store.set('codeBlockRendering.selectedCodeBlock', undefined);
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', undefined);

		const createGraphicCodeBlock = (
			codeBlock: ClassifiedProjectBlock,
			overrides: Partial<CodeBlockGraphicData> = {}
		): CodeBlockGraphicData => {
			// Parse @pos directive from code, default to (0,0) if missing or invalid
			const blockParsedDirectives = parseBlockDirectives(codeBlock.code);
			const posResult = parsePos(blockParsedDirectives);
			const gridX = posResult?.x ?? 0;
			const gridY = posResult?.y ?? 0;
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
				name: getCodeBlockNameFromSource(codeBlock.code),
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
				isFavorite: directiveState.blockState.isFavorite,
				alwaysOnTop: directiveState.blockState.alwaysOnTop ?? false,
				viewportAnchor: directiveState.blockState.viewportAnchor,
				parsedDirectives: blockParsedDirectives,
				...overrides,
			});
		};
		const createProjectCodeBlockSlice = (
			currentProject: ProjectObjectModel,
			projectPath: ProjectGroupPath
		): CodeBlockGraphicData[] => {
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
			const groupBlocks = currentProject.groups.map((group, groupIndex) => {
				const groupName = group.name;
				const gridX = groupIndex * 24;
				const gridY = -6;
				const groupCode = [...group.code];
				if (!parsePos(parseBlockDirectives(groupCode))) {
					let closerIndex = groupCode.length - 1;
					while (closerIndex >= 0 && groupCode[closerIndex].trim() === '') closerIndex -= 1;
					groupCode.splice(closerIndex, 0, `; @pos ${gridX} ${gridY}`);
				}
				const creationIndex = nextCodeBlockCreationIndex;
				nextCodeBlockCreationIndex += 1;
				return createGraphicCodeBlock(
					{
						id: creationIndex,
						code: groupCode,
						blockType: 'unknown',
						entry: group.entry,
					},
					{
						name: groupName,
						projectPath,
						nestedProjectCodeBlocks: createProjectCodeBlockSlice(
							group,
							createChildProjectGroupPath(projectPath, groupName)
						),
					}
				);
			});
			const projectCodeBlocks = [...projectScopeBlocks, ...codeBlocks, ...groupBlocks];

			// Stable-sort to maintain the partition: normal blocks first, always-on-top last.
			return partitionCodeBlocksByAlwaysOnTop(projectCodeBlocks);
		};
		const rootCodeBlocks = createProjectCodeBlockSlice(project, ROOT_PROJECT_GROUP_PATH);
		state.codeBlockRendering.nextCodeBlockCreationIndex = nextCodeBlockCreationIndex;

		store.set('codeBlockRendering.rootCodeBlocks', rootCodeBlocks);
		store.set('codeBlockRendering.codeBlocks', rootCodeBlocks);

		// Center viewport on first @home block without selecting it, or default to (0,0).
		const homeBlock = rootCodeBlocks.find(block => block.isHome);
		if (homeBlock) {
			const { x, y } = centerViewportOnCodeBlock(state.viewport, homeBlock, {
				alignment: homeBlock.homeAlignment,
			});
			updateViewport(state, x, y, events);
		} else {
			updateViewport(state, 0, 0, events);
		}
		incrementCompilerInputRevision(store);
	};

	// When user edits code, parse @pos and update runtime position if valid
	const applyPositionFromCodeEdit = () => {
		if (!state.codeBlockRendering.selectedCodeBlock) {
			return;
		}
		const codeBlock = state.codeBlockRendering.selectedCodeBlock;
		const posResult = parsePos(codeBlock.parsedDirectives);

		// Only update position if @pos is valid
		if (posResult !== undefined) {
			codeBlock.gridX = posResult.x;
			codeBlock.gridY = posResult.y;
			if (!codeBlock.viewportAnchor) {
				// World-space block: convert grid coordinates directly to pixels.
				codeBlock.x = posResult.x * state.viewport.vGrid;
				codeBlock.y = posResult.y * state.viewport.hGrid;
			}
			// Viewport-anchored block: x/y will be recomputed by block derivation
			// once width/height are up to date.
		}
	};

	updateAllBlockDerivedState();

	events.on<CodeBlockPointerDownEvent>('codeBlockPointerDown', onCodeBlockPointerDown);
	events.on<CodeBlockPointerDownEvent>('codeBlockPointerDown', ({ codeBlock }) => updateBlockDerivedState(codeBlock));
	events.on('runtimeInitialized', updateAllBlockDerivedState);
	events.on('spriteSheetRerendered', () => {
		recomputePixelCoordinatesAndBlockDerivedState();
		centerViewportOnSelectedOrHomeCodeBlock();
	});
	store.subscribe('codeErrors', updateAllBlockDerivedState);
	store.subscribe('assertionResults', updateAllBlockDerivedState);
	store.subscribe('compiler.isCompiling', updateAllBlockDerivedState);
	store.subscribe('initialProjectState', populateCodeBlocks);
	store.subscribe('codeBlockRendering.codeBlocks', updateAllBlockDerivedState);
	store.subscribe('info', updateAllBlockDerivedState);
	store.subscribe('codeBlockRendering.selectedCodeBlock', onSelectedCodeBlockChanged);
	store.subscribe('codeBlockRendering.selectedCodeBlock.code', updateSelectedCodeBlock);
	store.subscribe('codeBlockRendering.selectedCodeBlock.code', applyPositionFromCodeEdit);
	store.subscribe('codeBlockRendering.selectedCodeBlock.cursor', updateSelectedCodeBlock);
	store.subscribe('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', updateProgrammaticSelectedCodeBlock);
}
