import type {
	EditorCodeBlock,
	EventDispatcher,
	InternalPointerEvent,
	ProjectTransactions,
	State,
} from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import upsertPositionDirective from '../directives/block/upsertPositionDirective';
import replaceBlocksInPlace from '../project/blocks/replaceBlocksInPlace';
import { bringCodeBlockToFrontWithinPartition } from '../project/blocks/zOrder';
import { applyCodeBlockSourceEdits } from '../project/replaceBlockSources';
import findCodeBlockAtViewportCoordinates from './findCodeBlockAtViewportCoordinates';

/** Plugins may replace targets synchronously before core starts moving and snapping them. */
export interface ResolveCodeBlockDragTargetsEvent {
	codeBlock: EditorCodeBlock;
	altKey: InternalPointerEvent['altKey'];
	targets: EditorCodeBlock[];
}

export default function registerBlockDragging(
	store: StateManager<State> & { projectTransactions: ProjectTransactions },
	events: EventDispatcher
): () => void {
	const state = store.getState();
	// Resolve targets on pointerdown and cancel the gesture if the visible collection changes.
	// Pointer moves only visit the prepared targets, not the entire project.
	let dragSet: EditorCodeBlock[] = [];
	let didDrag = false;

	function discardPreview(block: EditorCodeBlock) {
		block.x = block.gridX * state.viewport.vGrid;
		block.y = block.gridY * state.viewport.hGrid;
	}

	function finishDrag() {
		if (didDrag) {
			for (const block of dragSet) discardPreview(block);
		}
		state.project.draggedCodeBlock = undefined;
		dragSet = [];
		didDrag = false;
	}

	function canDrag() {
		return state.gridSizeReady && state.viewport.vGrid > 0 && state.viewport.hGrid > 0;
	}

	function canContinueDrag() {
		return canDrag() && state.project.draggedCodeBlock && dragSet.length > 0;
	}

	function onPointerDown(event: InternalPointerEvent) {
		const { x, y, altKey } = event;
		finishDrag();
		if (!state.featureFlags.blockSelectionAndDragging || !canDrag()) {
			return;
		}

		const clickedBlock = findCodeBlockAtViewportCoordinates(state, x, y);
		store.set('project.selectedCodeBlock', clickedBlock);
		if (!clickedBlock || clickedBlock.readOnly) return;
		if (state.editorMode === 'edit') {
			state.project.draggedCodeBlock = clickedBlock;
			const dragTargets: ResolveCodeBlockDragTargetsEvent = {
				codeBlock: clickedBlock,
				altKey,
				targets: [clickedBlock],
			};
			events.dispatch('resolveCodeBlockDragTargets', dragTargets);
			const members = new Set(state.project.activeLevel.blocks);
			dragSet = dragTargets.targets.filter(block => !block.readOnly && members.has(block));
			if (dragSet.length === 0) finishDrag();
		}

		// Bring dragged module forward within its z-order partition.
		// Normal blocks move to the end of the normal segment (before always-on-top blocks).
		// Always-on-top blocks move to the end of the always-on-top segment (end of array).
		replaceBlocksInPlace(
			state.project.activeLevel.blocks,
			bringCodeBlockToFrontWithinPartition(state.project.activeLevel.blocks, clickedBlock)
		);
	}

	function onPointerMove(event: InternalPointerEvent) {
		const { movementX, movementY } = event;
		if (!canContinueDrag()) {
			finishDrag();
			return;
		}
		if (movementX !== 0 || movementY !== 0) {
			didDrag = true;
		}

		for (const block of dragSet) {
			block.x += movementX;
			block.y += movementY;
		}
		event.stopPropagation = true;
	}

	function onPointerUp() {
		const primaryBlock = state.project.draggedCodeBlock;
		if (!didDrag || !canContinueDrag() || !primaryBlock) {
			finishDrag();
			return;
		}

		const vGrid = state.viewport.vGrid;
		const hGrid = state.viewport.hGrid;

		// Compute a single snap delta based on the primary dragged block
		const snapGridX = Math.round(primaryBlock.x / vGrid);
		const snapGridY = Math.round(primaryBlock.y / hGrid);
		const snapX = snapGridX * vGrid;
		const snapY = snapGridY * hGrid;
		const deltaX = snapX - primaryBlock.x;
		const deltaY = snapY - primaryBlock.y;

		const edits: { codeBlock: EditorCodeBlock; code: string[] }[] = [];

		// Snap all blocks in drag set to grid using the same pixel delta
		for (const block of dragSet) {
			const gridX = Math.round((block.x + deltaX) / vGrid);
			const gridY = Math.round((block.y + deltaY) / hGrid);
			edits.push({ codeBlock: block, code: upsertPositionDirective(block.code, gridX, gridY) });
		}

		// Discard the transient preview. Source settlement projects changed positions;
		// a no-op keeps the previous position without requesting layout or publishing a revision.
		finishDrag();
		applyCodeBlockSourceEdits(store, edits);
	}

	events.on('pointerdown', onPointerDown);
	events.on('pointermove', onPointerMove);
	events.on('pointerup', onPointerUp);
	events.on('gridSizeChanged', finishDrag);
	store.subscribe('project.activeLevel.blocks', finishDrag);

	return () => {
		finishDrag();
		events.off('pointerdown', onPointerDown);
		events.off('pointermove', onPointerMove);
		events.off('pointerup', onPointerUp);
		events.off('gridSizeChanged', finishDrag);
		store.unsubscribe('project.activeLevel.blocks', finishDrag);
	};
}
