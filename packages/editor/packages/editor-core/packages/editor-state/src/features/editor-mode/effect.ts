import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

export default function editorMode(store: StateManager<State>, events: EventDispatcher): void {
	const state = store.getState();

	function enterEditMode(): void {
		if (state.editorMode !== 'view') {
			return;
		}

		store.set('editorMode', 'edit');
	}

	function exitToViewMode(): void {
		if (state.editorMode === 'view') {
			return;
		}

		store.set('editorMode', 'view');
	}

	events.on('enterEditMode', enterEditMode);
	events.on('exitToViewMode', exitToViewMode);
}
