import type {
	CodeBlockGraphicData,
	EventDispatcher,
	InternalPointerEvent,
	ProjectEdits,
	State,
} from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { bringCodeBlockToFrontWithinPartition } from '../../partitionCodeBlocksByAlwaysOnTop';
import replaceCodeBlocksInPlace from '../../replaceCodeBlocksInPlace';
import { applyCodeBlockSourceEdits } from '../../sourceEdits';
import findCodeBlockAtViewportCoordinates from '../../utils/finders/findCodeBlockAtViewportCoordinates';
import upsertPos from '../directives/pos/upsert';

/** Plugins may replace targets synchronously before core starts moving and snapping them. */
export interface ResolveCodeBlockDragTargetsEvent {
	codeBlock: CodeBlockGraphicData;
	altKey: InternalPointerEvent['altKey'];
	targets: CodeBlockGraphicData[];
}

export default function codeBlockDragger(
	store: StateManager<State> & { projectEdits: ProjectEdits },
	events: EventDispatcher
): () => void {
	const state = store.getState();
	// Resolve targets on pointerdown and keep them current when the visible collection changes.
	// Pointer moves only visit the prepared targets, not the entire project.
	let dragSet: CodeBlockGraphicData[] = [];
	let didDrag = false;

	function discardPreview(block: CodeBlockGraphicData) {
		block.x = block.gridX * state.viewport.vGrid;
		block.y = block.gridY * state.viewport.hGrid;
	}

	function finishDrag() {
		if (didDrag) {
			for (const block of dragSet) discardPreview(block);
		}
		state.codeBlockRendering.draggedCodeBlock = undefined;
		dragSet = [];
		didDrag = false;
	}

	function canDrag() {
		return state.gridSizeReady && state.viewport.vGrid > 0 && state.viewport.hGrid > 0;
	}

	function refreshDragTargets() {
		if (dragSet.length === 0) return;
		const { currentProject, draggedCodeBlock } = state.codeBlockRendering;
		const members = new Set(currentProject.blocks);
		if (!draggedCodeBlock || !members.has(draggedCodeBlock)) {
			finishDrag();
			return;
		}
		dragSet = dragSet.filter(block => {
			if (members.has(block)) return true;
			if (didDrag) discardPreview(block);
			return false;
		});
		if (dragSet.length === 0) finishDrag();
	}

	function canContinueDrag() {
		return canDrag() && state.codeBlockRendering.draggedCodeBlock && dragSet.length > 0;
	}

	function onPointerDown(event: InternalPointerEvent) {
		const { x, y, altKey } = event;
		finishDrag();
		if (!state.featureFlags.moduleDragging || !canDrag()) {
			return;
		}

		const clickedBlock = findCodeBlockAtViewportCoordinates(state, x, y);
		store.set('codeBlockRendering.selectedCodeBlock', clickedBlock);
		if (!clickedBlock || clickedBlock.readOnly) return;
		if (state.editorMode === 'edit') {
			state.codeBlockRendering.draggedCodeBlock = clickedBlock;
			const dragTargets: ResolveCodeBlockDragTargetsEvent = {
				codeBlock: clickedBlock,
				altKey,
				targets: [clickedBlock],
			};
			events.dispatch('resolveCodeBlockDragTargets', dragTargets);
			dragSet = dragTargets.targets.filter(block => !block.readOnly);
			if (dragSet.length === 0) finishDrag();
			else refreshDragTargets();
		}

		// Bring dragged module forward within its z-order partition.
		// Normal blocks move to the end of the normal segment (before always-on-top blocks).
		// Always-on-top blocks move to the end of the always-on-top segment (end of array).
		replaceCodeBlocksInPlace(
			state.codeBlockRendering.currentProject.blocks,
			bringCodeBlockToFrontWithinPartition(state.codeBlockRendering.currentProject.blocks, clickedBlock)
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
		const primaryBlock = state.codeBlockRendering.draggedCodeBlock;
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

		const edits: { codeBlock: CodeBlockGraphicData; code: string[] }[] = [];

		// Snap all blocks in drag set to grid using the same pixel delta
		for (const block of dragSet) {
			const gridX = Math.round((block.x + deltaX) / vGrid);
			const gridY = Math.round((block.y + deltaY) / hGrid);
			edits.push({ codeBlock: block, code: upsertPos(block.code, gridX, gridY) });
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
	store.subscribe('codeBlockRendering.currentProject.blocks', refreshDragTargets);

	return () => {
		finishDrag();
		events.off('pointerdown', onPointerDown);
		events.off('pointermove', onPointerMove);
		events.off('pointerup', onPointerUp);
		events.off('gridSizeChanged', finishDrag);
		store.unsubscribe('codeBlockRendering.currentProject.blocks', refreshDragTargets);
	};
}
