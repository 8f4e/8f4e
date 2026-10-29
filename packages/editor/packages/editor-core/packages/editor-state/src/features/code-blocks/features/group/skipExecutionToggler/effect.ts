import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { isSkipExecutionDirective } from '@8f4e/tokenizer';
import incrementCompilerInputRevision from '../../../../program-compiler/incrementCompilerInputRevision';
import { publishProjectChange } from '../../../../project-changes';
import setSkipExecution from '../../../utils/setSkipExecution';
import { getGroupModuleBlocks } from '../getGroupBlocks';

/**
 * Effect that handles toggling the #skipExecution directive for all code blocks in a group.
 * Provides a context menu action to skip/unskip all modules in a group at once.
 */
export default function groupSkipExecutionToggler(store: StateManager<State>, events: EventDispatcher): void {
	const state = store.getState();

	function onToggleGroupSkipExecutionDirective({ codeBlock }: { codeBlock: CodeBlockGraphicData }): void {
		if (!state.featureFlags.editing) {
			return;
		}

		// Only proceed if the code block has a group name
		if (!codeBlock.groupName) {
			return;
		}

		// Find all module blocks in the same group
		const groupBlocks = getGroupModuleBlocks(state.codeBlockRendering.codeBlocks, codeBlock.groupName);

		if (groupBlocks.length === 0) {
			return;
		}

		// Check if all group blocks have #skipExecution directive
		const allSkipped = groupBlocks.every(block => block.code.some(line => isSkipExecutionDirective(line)));
		let codeChanged = false;

		// Apply the same operation to all group blocks
		for (const block of groupBlocks) {
			// Set target code block for programmatic edit to avoid re-rendering all code blocks
			state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit = block;

			const result = setSkipExecution(block.code, !allSkipped);
			block.code = result.code;

			// Update lastUpdated to invalidate cache
			block.lastUpdated = Date.now();

			// Trigger store update to re-render only the specific code block
			store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block);
			codeChanged ||= result.changed;
		}
		if (codeChanged) {
			incrementCompilerInputRevision(store);
			publishProjectChange(store);
		}
	}

	events.on('toggleGroupSkipExecutionDirective', onToggleGroupSkipExecutionDirective);
}
