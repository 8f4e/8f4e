import type { Direction, EventDispatcher, NavigateCodeBlockEvent, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import gapCalculator from '../../../code-editing/gapCalculator';
import reverseGapCalculator from '../../../code-editing/reverseGapCalculator';
import animateViewport from '../../../viewport/animateViewport';
import centerViewportOnCodeBlock from '../../../viewport/centerViewportOnCodeBlock';
import centerViewportOnCodeBlockCursor from '../../../viewport/centerViewportOnCodeBlockCursor';
import findClosestCodeBlockInDirection from '../../utils/finders/findClosestCodeBlockInDirection';
import { deriveDirectiveState } from '../directives/registry';

type CodeBlockCursor = NonNullable<State['codeBlockRendering']['selectedCodeBlock']>['cursor'];
type CodeBlockCursorUpdate = Partial<CodeBlockCursor> & Pick<CodeBlockCursor, 'row' | 'col'>;

function setSelectedCodeBlockCursor(
	store: StateManager<State>,
	block: NonNullable<State['codeBlockRendering']['selectedCodeBlock']>,
	cursor: CodeBlockCursorUpdate
): void {
	const nextCursor = {
		...block.cursor,
		...cursor,
	};

	store.set('codeBlockRendering.selectedCodeBlock.cursor', nextCursor);
}

function alignTargetBlockCursorForHorizontalNavigation(
	store: StateManager<State>,
	sourceBlock: State['codeBlockRendering']['selectedCodeBlock'],
	targetBlock: State['codeBlockRendering']['selectedCodeBlock']
): void {
	if (!sourceBlock || !targetBlock) {
		return;
	}

	const state = store.getState();
	const sourceAbsoluteCursorY = sourceBlock.y + sourceBlock.cursor.y;
	const targetRelativeCursorY = sourceAbsoluteCursorY - targetBlock.y;
	const targetPhysicalRow = Math.max(Math.floor(targetRelativeCursorY / state.viewport.hGrid), 0);
	const targetDirectiveState = deriveDirectiveState(targetBlock.code, targetBlock.parsedDirectives, {
		isExpandedForEditing: true,
	});
	const targetDisplayRow = reverseGapCalculator(targetPhysicalRow, targetBlock.gaps);
	const boundedDisplayRow = Math.min(
		Math.max(targetDisplayRow, 0),
		Math.max(targetDirectiveState.displayModel.displayRowToSourceLineIndex.length - 1, 0)
	);
	const targetSourceLineIndex = targetDirectiveState.displayModel.displayRowToSourceLineIndex[boundedDisplayRow] ?? 0;

	setSelectedCodeBlockCursor(store, targetBlock, {
		row: targetSourceLineIndex,
		col: Math.min(sourceBlock.cursor.col, targetBlock.code[targetSourceLineIndex]?.length ?? 0),
		y: gapCalculator(boundedDisplayRow, targetBlock.gaps) * state.viewport.hGrid,
	});
}

function setBlockCursorToDisplayRow(
	store: StateManager<State>,
	block: NonNullable<State['codeBlockRendering']['selectedCodeBlock']>,
	displayRow: number,
	sourceCol?: number
): void {
	const state = store.getState();
	const directiveState = deriveDirectiveState(block.code, block.parsedDirectives, {
		isExpandedForEditing: true,
	});
	const maxDisplayRow = Math.max(directiveState.displayModel.displayRowToSourceLineIndex.length - 1, 0);
	const boundedDisplayRow = Math.min(Math.max(displayRow, 0), maxDisplayRow);
	const targetSourceLineIndex = directiveState.displayModel.displayRowToSourceLineIndex[boundedDisplayRow] ?? 0;

	setSelectedCodeBlockCursor(store, block, {
		row: targetSourceLineIndex,
		col: Math.min(sourceCol ?? block.cursor.col, block.code[targetSourceLineIndex]?.length ?? 0),
		y: gapCalculator(boundedDisplayRow, block.gaps) * state.viewport.hGrid,
	});
}

function getSelectedBlockDisplayRow(
	state: State,
	block: NonNullable<State['codeBlockRendering']['selectedCodeBlock']>
): number {
	const physicalRow = Math.max(Math.floor(block.cursor.y / state.viewport.hGrid), 0);
	return reverseGapCalculator(physicalRow, block.gaps);
}

function moveSelectionToCurrentBlockVerticalEdge(
	store: StateManager<State>,
	block: NonNullable<State['codeBlockRendering']['selectedCodeBlock']>,
	direction: 'up' | 'down'
): boolean {
	const state = store.getState();
	const directiveState = deriveDirectiveState(block.code, block.parsedDirectives, {
		isExpandedForEditing: true,
	});
	const maxDisplayRow = Math.max(directiveState.displayModel.displayRowToSourceLineIndex.length - 1, 0);
	const currentDisplayRow = getSelectedBlockDisplayRow(state, block);
	const edgeDisplayRow = direction === 'up' ? 0 : maxDisplayRow;

	if (currentDisplayRow === edgeDisplayRow) {
		return false;
	}

	setBlockCursorToDisplayRow(store, block, edgeDisplayRow);
	return true;
}

function alignTargetBlockCursorForVerticalNavigation(
	store: StateManager<State>,
	sourceBlock: NonNullable<State['codeBlockRendering']['selectedCodeBlock']>,
	targetBlock: NonNullable<State['codeBlockRendering']['selectedCodeBlock']>,
	direction: 'up' | 'down'
): void {
	const targetDirectiveState = deriveDirectiveState(targetBlock.code, targetBlock.parsedDirectives, {
		isExpandedForEditing: true,
	});
	const maxDisplayRow = Math.max(targetDirectiveState.displayModel.displayRowToSourceLineIndex.length - 1, 0);
	const targetDisplayRow = direction === 'up' ? maxDisplayRow : 0;

	setBlockCursorToDisplayRow(store, targetBlock, targetDisplayRow, sourceBlock.cursor.col);
}

/**
 * Navigates to a code block in the specified direction.
 * This is a reusable helper that handles both keyboard and automated navigation.
 *
 * @param store - The editor state manager
 * @param direction - The direction to navigate
 * @returns {boolean} true if navigation to a different block occurred, false if no block is selected or the target is the same as the current block
 */
export function navigateToCodeBlockInDirection(
	store: StateManager<State>,
	direction: Direction,
	events: EventDispatcher
): boolean {
	const state = store.getState();
	// Only proceed if a code block is currently selected
	if (!state.codeBlockRendering.selectedCodeBlock) {
		return false;
	}

	// Get the current viewport's code blocks
	const codeBlocks = state.codeBlockRendering.codeBlocks;
	const currentBlock = state.codeBlockRendering.selectedCodeBlock;

	// Find the closest code block in the specified direction
	if (
		(direction === 'up' || direction === 'down') &&
		moveSelectionToCurrentBlockVerticalEdge(store, currentBlock, direction)
	) {
		const { x, y } = centerViewportOnCodeBlockCursor(state.viewport, currentBlock);
		animateViewport(state, x, y, events);
		return true;
	}

	const targetBlock = findClosestCodeBlockInDirection(codeBlocks, currentBlock, direction);

	// If we found a different block, select it and center viewport on it
	if (targetBlock !== currentBlock) {
		store.set('codeBlockRendering.selectedCodeBlock', targetBlock);

		if (direction === 'left' || direction === 'right') {
			alignTargetBlockCursorForHorizontalNavigation(store, currentBlock, targetBlock);
		} else {
			alignTargetBlockCursorForVerticalNavigation(store, currentBlock, targetBlock, direction);
		}

		const { x, y } = centerViewportOnCodeBlockCursor(state.viewport, targetBlock);
		animateViewport(state, x, y, events);
		return true;
	}

	return false;
}

/**
 * Jumps to a specific code block by its creation index.
 *
 * Resolves the target block using creationIndex.
 * If the block is found, selects it and centers the viewport on it.
 *
 * @param store - The editor state manager
 * @param creationIndex - The stable runtime identifier of the target block
 * @returns {boolean} true if the block was found and jumped to, false otherwise
 */
export function jumpToCodeBlock(
	store: Pick<StateManager<State>, 'getState' | 'set'>,
	creationIndex: number,
	events: EventDispatcher
): boolean {
	const state = store.getState();
	const codeBlocks = state.codeBlockRendering.codeBlocks;

	const targetBlock = codeBlocks.find(block => block.creationIndex === creationIndex);

	// If we found a block, select it and center viewport on it
	if (targetBlock) {
		store.set('codeBlockRendering.selectedCodeBlock', targetBlock);
		const { x, y } = centerViewportOnCodeBlockCursor(state.viewport, targetBlock);
		animateViewport(state, x, y, events);
		return true;
	}

	// Block not found - no-op
	return false;
}

/**
 * Centers the viewport on the first @home code block, or defaults to origin.
 *
 * Selects the first code block with isHome=true (regardless of disabled state),
 * centers the viewport on it. If no home block exists, centers the viewport at (0,0).
 *
 * @param store - The editor state manager
 */
export function goHome(store: StateManager<State>, events: EventDispatcher): void {
	const state = store.getState();
	const homeBlock = state.codeBlockRendering.codeBlocks.find(block => block.isHome);

	if (homeBlock) {
		store.set('codeBlockRendering.selectedCodeBlock', homeBlock);
		const { x, y } = centerViewportOnCodeBlock(state.viewport, homeBlock, {
			alignment: homeBlock.homeAlignment,
		});
		animateViewport(state, x, y, events);
	} else {
		animateViewport(state, 0, 0, events);
	}
}

/**
 * Code block directional navigation effect.
 *
 * Listens for navigateCodeBlock events to enable navigation between code blocks.
 * When a navigateCodeBlock event is received with a direction,
 * this effect will:
 * - Find the closest code block in the specified direction
 * - Select that code block
 * - Center the viewport on the newly selected block
 *
 * If no code block is selected, the effect does nothing.
 *
 * @param store - The editor state manager
 * @param events - The event dispatcher
 */
export default function codeBlockNavigation(store: StateManager<State>, events: EventDispatcher): void {
	const onNavigateCodeBlock = (event: NavigateCodeBlockEvent) => {
		navigateToCodeBlockInDirection(store, event.direction, events);
	};

	const onGoHome = () => {
		goHome(store, events);
	};

	// Register the abstract navigation event handler
	events.on<NavigateCodeBlockEvent>('navigateCodeBlock', onNavigateCodeBlock);
	events.on('goHome', onGoHome);
}
