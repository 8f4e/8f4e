import type { EditorCodeBlock, ProjectSourceBlock, ProjectTransactions, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import upsertPositionDirective from '../directives/block/upsertPositionDirective';
import type { SerializedCodeBlock } from './serialization/codeBlockSerialization';

function placeSourceBlock(
	sourceBlock: SerializedCodeBlock,
	anchorGridX: number,
	anchorGridY: number
): ProjectSourceBlock {
	return {
		code: upsertPositionDirective(
			sourceBlock.code,
			anchorGridX + sourceBlock.gridCoordinates.x,
			anchorGridY + sourceBlock.gridCoordinates.y
		),
		entry: sourceBlock.entry,
		childLevel: sourceBlock.childLevel && {
			entries: sourceBlock.childLevel.entries,
			blocks: sourceBlock.childLevel.blocks.map(child => placeSourceBlock(child, 0, 0)),
		},
	};
}

/** Insert a source batch at a viewport pixel position, requiring an installed grid. Returns only the created blocks. */
export function insertCodeBlocks(
	store: Pick<StateManager<State>, 'getState'> & { projectTransactions: ProjectTransactions },
	{
		x,
		y,
		blocks,
	}: {
		x: number;
		y: number;
		blocks: readonly SerializedCodeBlock[];
	}
): EditorCodeBlock[] {
	const state = store.getState();

	const { vGrid, hGrid } = state.viewport;
	if (state.editorMode !== 'edit' || vGrid <= 0 || hGrid <= 0) {
		return [];
	}
	const targetLevel = state.project.activeLevel;

	// Place the source batch relative to the requested viewport position.
	const anchorGridX = Math.round((state.viewport.x + x) / vGrid);
	const anchorGridY = Math.round((state.viewport.y + y) / hGrid);

	return store.projectTransactions.apply({
		inserts: blocks.map(sourceBlock => ({
			targetLevel,
			source: placeSourceBlock(sourceBlock, anchorGridX, anchorGridY),
		})),
	}).insertedBlocks;
}
