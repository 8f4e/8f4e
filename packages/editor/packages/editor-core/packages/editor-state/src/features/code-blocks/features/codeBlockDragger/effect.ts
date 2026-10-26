import type { CodeBlockGraphicData, EventDispatcher, InternalMouseEvent, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { bringCodeBlockToFrontWithinPartition } from '../../partitionCodeBlocksByAlwaysOnTop';
import replaceCodeBlocksInPlace from '../../replaceCodeBlocksInPlace';
import findCodeBlockAtViewportCoordinates from '../../utils/finders/findCodeBlockAtViewportCoordinates';
import upsertPos from '../directives/pos/upsert';
import { worldPositionToAnchoredPos } from '../directives/viewport/resolve';
import { getGroupBlocks } from '../group/getGroupBlocks';

export interface CodeBlockPointerDownEvent {
	x: number;
	y: number;
	relativeX: number;
	relativeY: number;
	codeBlock: CodeBlockGraphicData;
}

export default function codeBlockDragger(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();
	// dragSet holds the blocks being dragged together. It's computed fresh on each mousedown
	// and cleared on mouseup, so concurrent drags are not a concern (only one drag at a time).
	let dragSet: CodeBlockGraphicData[] = [];
	let didDrag = false;

	function onMouseDown(event: InternalMouseEvent) {
		const { x, y, altKey } = event;
		if (!state.featureFlags.moduleDragging) {
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

		// Compute drag set based on nonstick flag and modifier
		// 1. If block is in a nonstick group and modifier is NOT held: single-block drag
		// 2. Else if block is in a nonstick group and modifier IS held: group-drag override
		// 3. Else if block is in a regular group (default) and modifier is NOT held: group drag
		// 4. Else if block is in a regular group and modifier IS held: single-block override
		// 5. Else: normal single-block drag
		if (draggedCodeBlock.groupName) {
			if (draggedCodeBlock.groupNonstick) {
				// Nonstick group: single-block by default, Alt for group drag
				if (altKey) {
					dragSet = getGroupBlocks(state.codeBlockRendering.codeBlocks, draggedCodeBlock.groupName);
				} else {
					dragSet = [draggedCodeBlock];
				}
			} else {
				// Regular group: group drag by default, Alt for single-block
				if (altKey) {
					dragSet = [draggedCodeBlock];
				} else {
					dragSet = getGroupBlocks(state.codeBlockRendering.codeBlocks, draggedCodeBlock.groupName);
				}
			}
		} else {
			// Single block drag (no group)
			dragSet = [draggedCodeBlock];
		}

		const relativeX = Math.abs(x - (draggedCodeBlock.x - state.viewport.x));
		const relativeY = Math.abs(y - (draggedCodeBlock.y - state.viewport.y));

		events.dispatch<CodeBlockPointerDownEvent>('codeBlockPointerDown', {
			x,
			y,
			relativeX,
			relativeY,
			codeBlock: draggedCodeBlock,
		});

		// Bring dragged module forward within its z-order partition.
		// Normal blocks move to the end of the normal segment (before always-on-top blocks).
		// Always-on-top blocks move to the end of the always-on-top segment (end of array).
		replaceCodeBlocksInPlace(
			state.codeBlockRendering.codeBlocks,
			bringCodeBlockToFrontWithinPartition(state.codeBlockRendering.codeBlocks, draggedCodeBlock)
		);

		if (!state.featureFlags.editing) {
			state.codeBlockRendering.draggedCodeBlock = undefined;
			dragSet = [];
			didDrag = false;
		}
	}

	function onMouseMove(event: InternalMouseEvent) {
		const { movementX, movementY } = event;
		if (state.codeBlockRendering.draggedCodeBlock && dragSet.length > 0) {
			if (movementX !== 0 || movementY !== 0) {
				didDrag = true;
			}

			// Apply movement to all blocks in drag set
			for (const block of dragSet) {
				block.x += movementX;
				block.y += movementY;
			}
			event.stopPropagation = true;
		}
	}

	function onMouseUp() {
		if (!state.codeBlockRendering.draggedCodeBlock || dragSet.length === 0) {
			return;
		}

		if (!didDrag) {
			state.codeBlockRendering.draggedCodeBlock = undefined;
			dragSet = [];
			return;
		}

		const primaryBlock = state.codeBlockRendering.draggedCodeBlock;
		const vGrid = state.viewport.vGrid;
		const hGrid = state.viewport.hGrid;

		// Compute a single snap delta based on the primary dragged block
		const snapGridX = Math.round(primaryBlock.x / vGrid);
		const snapGridY = Math.round(primaryBlock.y / hGrid);
		const snapX = snapGridX * vGrid;
		const snapY = snapGridY * hGrid;
		const deltaX = snapX - primaryBlock.x;
		const deltaY = snapY - primaryBlock.y;

		// Snap all blocks in drag set to grid using the same pixel delta
		for (const block of dragSet) {
			block.x += deltaX;
			block.y += deltaY;

			let gridX: number;
			let gridY: number;

			if (block.viewportAnchor) {
				// Viewport-anchored: convert dragged world-space position back to anchored @pos offset coordinates.
				// x/y pixel position is not snapped here; it will be recomputed by updateGraphics() using the
				// updated gridX/gridY anchored offsets after the code edit triggers a re-render.
				const anchored = worldPositionToAnchoredPos({
					anchor: block.viewportAnchor,
					worldX: block.x,
					worldY: block.y,
					viewportX: state.viewport.x,
					viewportY: state.viewport.y,
					viewportWidth: state.viewport.roundedWidth,
					viewportHeight: state.viewport.roundedHeight,
					blockWidth: block.width,
					blockHeight: block.height,
					vGrid,
					hGrid,
				});
				gridX = anchored.gridX;
				gridY = anchored.gridY;
			} else {
				// World-space: snap pixel position to the grid and derive grid coordinates.
				gridX = Math.round(block.x / vGrid);
				gridY = Math.round(block.y / hGrid);
				block.x = gridX * vGrid;
				block.y = gridY * hGrid;
			}

			block.gridX = gridX;
			block.gridY = gridY;
			block.lastUpdated = Date.now();
			block.code = upsertPos(block.code, gridX, gridY);
			store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block);
		}

		state.codeBlockRendering.draggedCodeBlock = undefined;
		dragSet = [];
		didDrag = false;
	}

	events.on('mousedown', onMouseDown);
	events.on('mousemove', onMouseMove);
	events.on('mouseup', onMouseUp);

	return () => {
		events.off('mousedown', onMouseDown);
		events.off('mousemove', onMouseMove);
		events.off('mouseup', onMouseUp);
	};
}
