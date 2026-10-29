import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';

import type { StateManager } from '@8f4e/state-manager';
import { publishProjectChange } from '../../../../project-changes';
import { removeDirective } from '../../directiveEditing';

/**
 * Effect that handles removing the ; @group directive from code blocks.
 * Provides a context menu action to remove a block from its group.
 */
export default function groupRemover(store: StateManager<State>, events: EventDispatcher): void {
	const state = store.getState();

	function onRemoveFromGroupDirective({ codeBlock }: { codeBlock: CodeBlockGraphicData }): void {
		if (!state.featureFlags.editing) {
			return;
		}

		// Set target code block for programmatic edit to avoid re-rendering all code blocks
		state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit = codeBlock;

		// Check if code block has a valid ; @group directive (reflected in derived groupName)
		if (codeBlock.groupName) {
			// Remove all ; @group directive lines
			codeBlock.code = removeDirective(codeBlock.code, 'group');

			// Update lastUpdated to invalidate cache
			codeBlock.lastUpdated = Date.now();

			// Trigger store update to re-render only the specific code block
			store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', codeBlock);
			publishProjectChange(store);
		}
	}

	events.on('removeFromGroupDirective', onRemoveFromGroupDirective);
}
