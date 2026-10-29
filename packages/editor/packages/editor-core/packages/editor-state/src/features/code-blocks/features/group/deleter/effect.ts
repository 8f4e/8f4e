import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';

import type { StateManager } from '@8f4e/state-manager';
import incrementCompilerInputRevision from '../../../../program-compiler/incrementCompilerInputRevision';
import { publishProjectChange } from '../../../../project-changes';
import replaceCodeBlocksInPlace from '../../../replaceCodeBlocksInPlace';
import { getGroupBlocks } from '../getGroupBlocks';

/**
 * Effect that handles deleting all code blocks in a group.
 * Provides a context menu action to delete an entire group at once without confirmation.
 */
export default function groupDeleter(store: StateManager<State>, events: EventDispatcher): void {
	function onDeleteGroup({ codeBlock }: { codeBlock: CodeBlockGraphicData }): void {
		const state = store.getState();

		if (!state.featureFlags.editing) {
			return;
		}

		// Get the group name from the selected code block
		const groupName = codeBlock.groupName;

		if (!groupName) {
			return;
		}

		// Find all code blocks with the same group name
		const groupBlocks = getGroupBlocks(state.codeBlockRendering.codeBlocks, groupName);

		// Create a Set of blocks to delete for O(1) lookup
		const blocksToDelete = new Set(groupBlocks);

		// Filter out all blocks in the group
		const remainingBlocks = state.codeBlockRendering.codeBlocks.filter(block => !blocksToDelete.has(block));
		const blocksRemoved = remainingBlocks.length !== state.codeBlockRendering.codeBlocks.length;

		// Clear selected/dragged references if they point to deleted blocks
		if (state.codeBlockRendering.selectedCodeBlock && blocksToDelete.has(state.codeBlockRendering.selectedCodeBlock)) {
			store.set('codeBlockRendering.selectedCodeBlock', undefined);
		}

		if (state.codeBlockRendering.draggedCodeBlock && blocksToDelete.has(state.codeBlockRendering.draggedCodeBlock)) {
			state.codeBlockRendering.draggedCodeBlock = undefined;
		}

		// Clear programmatic selection if it points to a deleted block
		if (
			state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit &&
			blocksToDelete.has(state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit)
		) {
			state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit = undefined;
		}

		// Update the code blocks array
		replaceCodeBlocksInPlace(state.codeBlockRendering.codeBlocks, remainingBlocks);
		store.set('codeBlockRendering.codeBlocks', state.codeBlockRendering.codeBlocks);
		if (blocksRemoved) {
			incrementCompilerInputRevision(store);
			publishProjectChange(store);
		}
	}

	events.on('deleteGroup', onDeleteGroup);
}
