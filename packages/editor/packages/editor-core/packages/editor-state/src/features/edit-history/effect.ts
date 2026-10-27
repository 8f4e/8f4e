import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

import serializeToProject from '../../pureHelpers/projectSerialization/serializeToProject';

export default function historyTracking(store: StateManager<State>, events: EventDispatcher): void | (() => void) {
	const state = store.getState();
	if (!state.featureFlags.historyTracking) {
		return;
	}

	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	const DEBOUNCE_DELAY = 1000;

	function saveHistory() {
		if (state.historyStack.length >= 10) {
			state.historyStack.shift();
		}

		state.historyStack.push(serializeToProject(state));
		state.redoStack = [];
	}

	function onCodeChange() {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		saveTimeout = setTimeout(() => {
			saveHistory();
			saveTimeout = null;
		}, DEBOUNCE_DELAY);
	}

	function undo() {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}

		const previousState = state.historyStack.pop();
		if (previousState) {
			if (state.redoStack.length >= 10) {
				state.redoStack.shift();
			}
			state.redoStack.push(serializeToProject(state));
			events.dispatch('loadProject', { project: previousState, preserveFileAssociation: true });
		}
	}

	function redo() {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}

		const nextState = state.redoStack.pop();
		if (nextState) {
			if (state.historyStack.length >= 10) {
				state.historyStack.shift();
			}
			state.historyStack.push(serializeToProject(state));
			events.dispatch('loadProject', { project: nextState, preserveFileAssociation: true });
		}
	}

	store.subscribe('codeBlockRendering.selectedCodeBlock.code', onCodeChange);
	events.on('undo', undo);
	events.on('redo', redo);

	return () => {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		store.unsubscribe('codeBlockRendering.selectedCodeBlock.code', onCodeChange);
		events.off('undo', undo);
		events.off('redo', redo);
	};
}
