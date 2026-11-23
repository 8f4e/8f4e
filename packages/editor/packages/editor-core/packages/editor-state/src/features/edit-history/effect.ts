import type { EditorProjectSnapshot, EventDispatcher, ProjectChange, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

import type { ProjectEditService } from '../project-edits/service';
import { sameProjectSnapshot } from '../project-edits/snapshot';

const DEBOUNCE_DELAY = 1000;
const HISTORY_LIMIT = 10;

export default function historyTracking(
	store: StateManager<State>,
	events: EventDispatcher,
	projectEdits: Pick<ProjectEditService, 'capture' | 'restore'>
): () => void {
	const state = store.getState();
	let present = projectEdits.capture();
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let editPending = false;

	function cancelPendingEdit() {
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = null;
		editPending = false;
	}

	function pushHistory(project: EditorProjectSnapshot) {
		if (state.historyStack.length >= HISTORY_LIMIT) state.historyStack.shift();
		state.historyStack.push(project);
	}

	function commitPendingEdit() {
		const pending = editPending;
		cancelPendingEdit();
		if (!pending) return;

		const current = projectEdits.capture();
		if (sameProjectSnapshot(current, present)) return;
		pushHistory(present);
		present = current;
	}

	function onProjectChange({ kind, history }: ProjectChange) {
		if (history === 'skip') {
			// Do not turn a skipped operation into a separate checkpoint, discard redo, or
			// replace the before-state of an authored edit that is still pending.
			if (!editPending) present = projectEdits.capture();
			return;
		}
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
		present = projectEdits.capture();
	}

	function undo() {
		if (!state.featureFlags.historyTracking) return;
		commitPendingEdit();
		const previousState = state.historyStack.pop();
		if (!previousState) return;
		if (state.redoStack.length >= HISTORY_LIMIT) state.redoStack.shift();
		state.redoStack.push(present);
		projectEdits.restore(previousState);
	}

	function redo() {
		if (!state.featureFlags.historyTracking) return;
		commitPendingEdit();
		const nextState = state.redoStack.pop();
		if (!nextState) return;
		pushHistory(present);
		projectEdits.restore(nextState);
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
