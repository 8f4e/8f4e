import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import applyEditorMode from './applyEditorMode';

export default function editorMode(store: StateManager<State>, events: EventDispatcher): void {
	const state = store.getState();

	function enterEditMode(): void {
		if (state.editorMode !== 'view') {
			return;
		}

		applyEditorMode(store, 'edit');
	}

	function exitToViewMode(): void {
		if (state.editorMode === 'view') {
			return;
		}

		applyEditorMode(store, 'view');
	}

	events.on('enterEditMode', enterEditMode);
	events.on('exitToViewMode', exitToViewMode);
}
