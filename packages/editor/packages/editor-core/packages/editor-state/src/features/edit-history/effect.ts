import type { EventDispatcher, ProjectChange, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';

import serializeToProject from '../../pureHelpers/projectSerialization/serializeToProject';
import { restoreProject } from '../project-changes';

const DEBOUNCE_DELAY = 1000;
const HISTORY_LIMIT = 10;

export default function historyTracking(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();
	// Serialization returns detached snapshots that history can retain directly.
	let present = serializeToProject(state);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let editPending = false;

	function cancelPendingEdit() {
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = null;
		editPending = false;
	}

	function pushHistory(project: ProjectObjectModel) {
		if (state.historyStack.length >= HISTORY_LIMIT) state.historyStack.shift();
		state.historyStack.push(project);
	}

	function commitPendingEdit() {
		const pending = editPending;
		cancelPendingEdit();
		if (!pending) return;

		const current = serializeToProject(state);
		if (JSON.stringify(current) === JSON.stringify(present)) return;
		pushHistory(present);
		present = current;
	}

	function onProjectChange({ kind }: ProjectChange) {
		if (kind === 'edit' && state.featureFlags.historyTracking) {
			state.redoStack = [];
			editPending = true;
			if (saveTimeout) clearTimeout(saveTimeout);
			saveTimeout = setTimeout(commitPendingEdit, DEBOUNCE_DELAY);
			return;
		}

		cancelPendingEdit();
		if (kind === 'replace') {
			state.historyStack = [];
			state.redoStack = [];
		} else if (kind === 'checkpoint' && state.featureFlags.historyTracking) {
			pushHistory(present);
			state.redoStack = [];
		}
		present = serializeToProject(state);
	}

	function undo() {
		if (!state.featureFlags.historyTracking) return;
		commitPendingEdit();
		const previousState = state.historyStack.pop();
		if (!previousState) return;
		if (state.redoStack.length >= HISTORY_LIMIT) state.redoStack.shift();
		state.redoStack.push(present);
		restoreProject(store, previousState, 'restore');
	}

	function redo() {
		if (!state.featureFlags.historyTracking) return;
		commitPendingEdit();
		const nextState = state.redoStack.pop();
		if (!nextState) return;
		pushHistory(present);
		restoreProject(store, nextState, 'restore');
	}

	store.subscribe('projectChange', onProjectChange);
	events.on('undo', undo);
	events.on('redo', redo);
	events.on('beforeProjectEdit', commitPendingEdit);

	return () => {
		cancelPendingEdit();
		store.unsubscribe('projectChange', onProjectChange);
		events.off('undo', undo);
		events.off('redo', redo);
		events.off('beforeProjectEdit', commitPendingEdit);
	};
}
