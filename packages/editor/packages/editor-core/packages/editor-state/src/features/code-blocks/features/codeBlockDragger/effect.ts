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
	// dragSet holds the blocks being dragged together. It's computed fresh on each pointerdown
	// and cleared on pointerup, so concurrent drags are not a concern (only one drag at a time).
	let dragSet: CodeBlockGraphicData[] = [];
	let didDrag = false;

	function finishDrag() {
		if (didDrag) {
			const { vGrid, hGrid } = state.viewport;
			for (const block of dragSet) {
				block.x = block.gridX * vGrid;
				block.y = block.gridY * hGrid;
			}
		}
		state.codeBlockRendering.draggedCodeBlock = undefined;
		dragSet = [];
		didDrag = false;
	}

	function canDrag() {
		return state.gridSizeReady && state.viewport.vGrid > 0 && state.viewport.hGrid > 0;
	}

	function survivingTargets() {
		const { currentProject, draggedCodeBlock } = state.codeBlockRendering;
		if (!canDrag() || !draggedCodeBlock || !currentProject.blocks.includes(draggedCodeBlock)) return [];
		return dragSet.filter(block => currentProject.blocks.includes(block));
	}

	function onPointerDown(event: InternalPointerEvent) {
		const { x, y, altKey } = event;
		finishDrag();
		if (!state.featureFlags.moduleDragging || !canDrag()) {
			return;
		}

		state.codeBlockRendering.draggedCodeBlock = findCodeBlockAtViewportCoordinates(state, x, y);
		const draggedCodeBlock = state.codeBlockRendering.draggedCodeBlock;

		if (!draggedCodeBlock) {
			store.set('codeBlockRendering.selectedCodeBlock', undefined);
			dragSet = [];
			didDrag = false;
			return;
		}
		store.set('codeBlockRendering.selectedCodeBlock', state.codeBlockRendering.draggedCodeBlock);
		didDrag = false;

		const dragTargets: ResolveCodeBlockDragTargetsEvent = {
			codeBlock: draggedCodeBlock,
			altKey,
			targets: [draggedCodeBlock],
		};
		events.dispatch('resolveCodeBlockDragTargets', dragTargets);
		dragSet = dragTargets.targets;

		// Bring dragged module forward within its z-order partition.
		// Normal blocks move to the end of the normal segment (before always-on-top blocks).
		// Always-on-top blocks move to the end of the always-on-top segment (end of array).
		replaceCodeBlocksInPlace(
			state.codeBlockRendering.currentProject.blocks,
			bringCodeBlockToFrontWithinPartition(state.codeBlockRendering.currentProject.blocks, draggedCodeBlock)
		);

		if (state.editorMode !== 'edit') {
			state.codeBlockRendering.draggedCodeBlock = undefined;
			dragSet = [];
			didDrag = false;
		}
	}

	function onPointerMove(event: InternalPointerEvent) {
		const { movementX, movementY } = event;
		const targets = survivingTargets();
		if (targets.length === 0) {
			finishDrag();
			return;
		}
		if (movementX !== 0 || movementY !== 0) {
			didDrag = true;
		}

		// A project edit can remove a target while the pointer is held.
		for (const block of targets) {
			block.x += movementX;
			block.y += movementY;
		}
		event.stopPropagation = true;
	}

	function onPointerUp() {
		const targets = survivingTargets();
		const primaryBlock = state.codeBlockRendering.draggedCodeBlock;
		if (!didDrag || targets.length === 0 || !primaryBlock) {
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
		for (const block of targets) {
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

	return () => {
		finishDrag();
		events.off('pointerdown', onPointerDown);
		events.off('pointermove', onPointerMove);
		events.off('pointerup', onPointerUp);
		events.off('gridSizeChanged', finishDrag);
	};
}
