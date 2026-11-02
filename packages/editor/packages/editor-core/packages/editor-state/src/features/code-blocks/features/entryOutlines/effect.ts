import type { State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import deriveEntryOutlines from './deriveEntryOutlines';

export default function entryOutlines(store: StateManager<State>): void {
	const state = store.getState();

	function syncEntryOutlines(): void {
		store.set(
			'codeBlockRendering.entryOutlines',
			deriveEntryOutlines(
				state.codeBlockRendering.currentProject.blocks,
				state.viewport.vGrid * 8,
				state.viewport.hGrid * 4
			)
		);
	}

	store.subscribe('codeBlockRendering.currentProject.blocks', syncEntryOutlines);
	store.subscribe('codeBlockRendering.selectedCodeBlock.code', syncEntryOutlines);
	store.subscribe('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', syncEntryOutlines);

	syncEntryOutlines();
}
