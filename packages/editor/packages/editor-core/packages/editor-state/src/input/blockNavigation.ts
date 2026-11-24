import type { Direction, EventDispatcher, NavigateCodeBlockEvent, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import displayRowToGridRow from '../layout/text-geometry/displayRowToGridRow';
import gridRowToDisplayRow from '../layout/text-geometry/gridRowToDisplayRow';
import centerViewportOnCodeBlockCursor from '../viewport/centerViewportOnCodeBlockCursor';
import updateViewport from '../viewport/updateViewport';
import findClosestCodeBlockInDirection from './findClosestCodeBlockInDirection';

type CodeBlockCursor = NonNullable<State['project']['selectedCodeBlock']>['cursor'];
type CodeBlockCursorUpdate = Partial<CodeBlockCursor> & Pick<CodeBlockCursor, 'row' | 'col'>;

function setSelectedCodeBlockCursor(
	store: StateManager<State>,
	block: NonNullable<State['project']['selectedCodeBlock']>,
	cursor: CodeBlockCursorUpdate
): void {
	const nextCursor = {
		...block.cursor,
		...cursor,
	};

	store.set('project.selectedCodeBlock.cursor', nextCursor);
}

function alignTargetBlockCursorForHorizontalNavigation(
	store: StateManager<State>,
	sourceBlock: State['project']['selectedCodeBlock'],
	targetBlock: State['project']['selectedCodeBlock']
): void {
	if (!sourceBlock || !targetBlock) {
		return;
	}

	const state = store.getState();
	const sourceAbsoluteCursorY = sourceBlock.y + sourceBlock.cursor.y;
	const targetRelativeCursorY = sourceAbsoluteCursorY - targetBlock.y;
	const targetPhysicalRow = Math.max(Math.floor(targetRelativeCursorY / state.viewport.hGrid), 0);
	const displayModel = targetBlock.displayModel;
	const targetDisplayRow = gridRowToDisplayRow(targetPhysicalRow, targetBlock.gaps);
	const boundedDisplayRow = Math.min(
		Math.max(targetDisplayRow, 0),
		Math.max(displayModel.displayRowToSourceLineIndex.length - 1, 0)
	);
	const targetSourceLineIndex = displayModel.displayRowToSourceLineIndex[boundedDisplayRow] ?? 0;

	setSelectedCodeBlockCursor(store, targetBlock, {
		row: targetSourceLineIndex,
		col: Math.min(sourceBlock.cursor.col, targetBlock.code[targetSourceLineIndex]?.length ?? 0),
		y: displayRowToGridRow(boundedDisplayRow, targetBlock.gaps) * state.viewport.hGrid,
	});
}

function setBlockCursorToDisplayRow(
	store: StateManager<State>,
	block: NonNullable<State['project']['selectedCodeBlock']>,
	displayRow: number,
	sourceCol?: number
): void {
	const state = store.getState();
	const displayModel = block.displayModel;
	const maxDisplayRow = Math.max(displayModel.displayRowToSourceLineIndex.length - 1, 0);
	const boundedDisplayRow = Math.min(Math.max(displayRow, 0), maxDisplayRow);
	const targetSourceLineIndex = displayModel.displayRowToSourceLineIndex[boundedDisplayRow] ?? 0;

	setSelectedCodeBlockCursor(store, block, {
		row: targetSourceLineIndex,
		col: Math.min(sourceCol ?? block.cursor.col, block.code[targetSourceLineIndex]?.length ?? 0),
		y: displayRowToGridRow(boundedDisplayRow, block.gaps) * state.viewport.hGrid,
	});
}

function getSelectedBlockDisplayRow(state: State, block: NonNullable<State['project']['selectedCodeBlock']>): number {
	const physicalRow = Math.max(Math.floor(block.cursor.y / state.viewport.hGrid), 0);
	return gridRowToDisplayRow(physicalRow, block.gaps);
}

function moveSelectionToCurrentBlockVerticalEdge(
	store: StateManager<State>,
	block: NonNullable<State['project']['selectedCodeBlock']>,
	direction: 'up' | 'down'
): boolean {
	const state = store.getState();
	const displayModel = block.displayModel;
	const maxDisplayRow = Math.max(displayModel.displayRowToSourceLineIndex.length - 1, 0);
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
	sourceBlock: NonNullable<State['project']['selectedCodeBlock']>,
	targetBlock: NonNullable<State['project']['selectedCodeBlock']>,
	direction: 'up' | 'down'
): void {
	const displayModel = targetBlock.displayModel;
	const maxDisplayRow = Math.max(displayModel.displayRowToSourceLineIndex.length - 1, 0);
	const targetDisplayRow = direction === 'up' ? maxDisplayRow : 0;

	setBlockCursorToDisplayRow(store, targetBlock, targetDisplayRow, sourceBlock.cursor.col);
}

/**
 * Navigates to a code block in the specified direction.
 * This is a reusable helper that handles both keyboard and automated navigation.
 *
 * @param store - The editor state manager
 * @param direction - The direction to navigate
 * @param events - The event dispatcher
 * @returns {boolean} true if navigation to a different block occurred, false if no block is selected or the target is the same as the current block
 */
export function navigateToCodeBlockInDirection(
	store: StateManager<State>,
	direction: Direction,
	events: EventDispatcher
): boolean {
	const state = store.getState();
	// Only proceed if a code block is currently selected
	if (!state.project.selectedCodeBlock) {
		return false;
	}

	// Get the current viewport's code blocks
	const codeBlocks = state.project.activeLevel.blocks;
	const currentBlock = state.project.selectedCodeBlock;

	// Find the closest code block in the specified direction
	if (
		(direction === 'up' || direction === 'down') &&
		moveSelectionToCurrentBlockVerticalEdge(store, currentBlock, direction)
	) {
		const { x, y } = centerViewportOnCodeBlockCursor(state.viewport, currentBlock);
		updateViewport(state, x, y, events, 'navigation');
		return true;
	}

	const targetBlock = findClosestCodeBlockInDirection(codeBlocks, currentBlock, direction);

	// If we found a different block, select it and center viewport on it
	if (targetBlock !== currentBlock) {
		store.set('project.selectedCodeBlock', targetBlock);

		if (direction === 'left' || direction === 'right') {
			alignTargetBlockCursorForHorizontalNavigation(store, currentBlock, targetBlock);
		} else {
			alignTargetBlockCursorForVerticalNavigation(store, currentBlock, targetBlock, direction);
		}

		const { x, y } = centerViewportOnCodeBlockCursor(state.viewport, targetBlock);
		updateViewport(state, x, y, events, 'navigation');
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
 * @param events - The event dispatcher
 * @returns {boolean} true if the block was found and jumped to, false otherwise
 */
export function jumpToCodeBlock(
	store: Pick<StateManager<State>, 'getState' | 'set'>,
	creationIndex: number,
	events: EventDispatcher
): boolean {
	const state = store.getState();
	const codeBlocks = state.project.activeLevel.blocks;

	const targetBlock = codeBlocks.find(block => block.creationIndex === creationIndex);

	// If we found a block, select it and center viewport on it
	if (targetBlock) {
		store.set('project.selectedCodeBlock', targetBlock);
		const { x, y } = centerViewportOnCodeBlockCursor(state.viewport, targetBlock);
		updateViewport(state, x, y, events, 'navigation');
		return true;
	}

	// Block not found - no-op
	return false;
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
export default function registerBlockNavigation(store: StateManager<State>, events: EventDispatcher): void {
	const onNavigateCodeBlock = (event: NavigateCodeBlockEvent) => {
		navigateToCodeBlockInDirection(store, event.direction, events);
	};

	// Register the abstract navigation event handler
	events.on('navigateCodeBlock', onNavigateCodeBlock);
}
