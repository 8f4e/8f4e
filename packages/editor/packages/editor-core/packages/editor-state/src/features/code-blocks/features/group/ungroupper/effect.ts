import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { publishProjectChange } from '../../../../project-changes';
import { removeDirective } from '../../directiveEditing';
import { getGroupBlocks } from '../getGroupBlocks';

/**
 * Effect that handles removing the ; @group directive from all blocks with a specific group name.
 * Provides a context menu action to ungroup all blocks in a group at once.
 */
export default function groupUngroupper(store: StateManager<State>, events: EventDispatcher): void {
	function onUngroupByName({ codeBlock }: { codeBlock: CodeBlockGraphicData }): void {
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

		// Remove ; @group directive from all blocks in the group
		groupBlocks.forEach(block => {
			// Remove all ; @group directive lines
			block.code = removeDirective(block.code, 'group');

			// Update lastUpdated to invalidate cache
			block.lastUpdated = Date.now();
		});

		// Trigger store update to refresh all affected blocks
		// Using codeBlocks array update to ensure all blocks are refreshed
		store.set('codeBlockRendering.codeBlocks', state.codeBlockRendering.codeBlocks);
		if (groupBlocks.length > 0) {
			publishProjectChange(store);
		}
	}

	events.on('ungroupByName', onUngroupByName);
}
