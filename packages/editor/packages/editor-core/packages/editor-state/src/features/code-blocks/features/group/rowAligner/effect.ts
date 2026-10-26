import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import incrementProjectRevision from '../../../../program-compiler/incrementProjectRevision';
import getCodeBlockGridWidth from '../../../getCodeBlockGridWidth';
import upsertPos from '../../directives/pos/upsert';
import { getGroupBlocks } from '../getGroupBlocks';

/** Fixed horizontal gap, in grid columns, left between neighbouring blocks in the row. */
const ROW_GAP_GRID_COLUMNS = 4;

/**
 * Effect that handles aligning all code blocks in a group into a single horizontal row.
 * Provides a context menu action that keeps the blocks' left-to-right order, moves every
 * block to the first block's row, and separates neighbours by a fixed gap of 4 grid columns.
 * All positions are updated inside one event dispatch, so the edit history records the
 * whole alignment as a single undo step.
 */
export default function groupRowAligner(store: StateManager<State>, events: EventDispatcher): void {
  function moveBlock(state: State, block: CodeBlockGraphicData, gridX: number, gridY: number): void {
    if (block.gridX === gridX && block.gridY === gridY) {
      return;
    }

    // Mirror the codeBlockDragger mutation so rendering, the persisted ; @pos
    // directive, and the compiler input all pick up the new position.
    block.gridX = gridX;
    block.gridY = gridY;
    block.x = gridX * state.viewport.vGrid;
    block.y = gridY * state.viewport.hGrid;
    block.lastUpdated = Date.now();
    block.code = upsertPos(block.code, gridX, gridY);
    store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block);
  }

  function onAlignGroupBlocksInRow({ codeBlock }: { codeBlock: CodeBlockGraphicData }): void {
    const state = store.getState();

    if (!state.featureFlags.editing) {
      return;
    }

    // Only proceed if the code block has a group name
    const groupName = codeBlock.groupName;

    if (!groupName) {
      return;
    }

    // Find all code blocks with the same group name
    const groupBlocks = getGroupBlocks(state.codeBlockRendering.codeBlocks, groupName);

    if (groupBlocks.length < 2) {
      return;
    }

    // Sort by current horizontal position; the stable sort keeps the current
    // relative order of blocks that share the same gridX.
    const sortedBlocks = [...groupBlocks].sort((a, b) => a.gridX - b.gridX);
    const [firstBlock, ...remainingBlocks] = sortedBlocks;
    const rowGridY = firstBlock.gridY;

    // Plan every position before moving anything: widths are measured on the
    // blocks' current code, while moving a block rewrites its code (the ; @pos
    // directive), which would change the measured width of an already-moved neighbour.
    // The first block anchors the row: it keeps its position and lends its gridY.
    const plannedPositions = new Map<CodeBlockGraphicData, number>();
    let previousBlock = firstBlock;
    let previousGridX = firstBlock.gridX;

    for (const block of remainingBlocks) {
      const gridX =
        previousGridX + getCodeBlockGridWidth(previousBlock.code, previousBlock.minGridWidth) + ROW_GAP_GRID_COLUMNS;

      plannedPositions.set(block, gridX);
      previousBlock = block;
      previousGridX = gridX;
    }

    let didMove = false;
    for (const [block, gridX] of plannedPositions) {
      if (block.gridX !== gridX || block.gridY !== rowGridY) {
        didMove = true;
      }
      moveBlock(state, block, gridX, rowGridY);
    }
    if (didMove) {
      incrementProjectRevision(store);
    }
  }

  events.on('alignGroupBlocksInRow', onAlignGroupBlocksInRow);
}
