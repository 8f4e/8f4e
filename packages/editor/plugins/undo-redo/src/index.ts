import type { EditorPlugin, EditorPluginContext } from '@8f4e/editor-core';
import { sameProjectSnapshot } from '@8f4e/editor-state';
import type { EditorProjectSnapshot, ProjectChange } from '@8f4e/editor-state-types';

const DEBOUNCE_DELAY = 1000;
const HISTORY_LIMIT = 10;

function setup({ store, events }: EditorPluginContext): () => void {
	const { projectTransactions } = store;
	const undoStack: EditorProjectSnapshot[] = [];
	const redoStack: EditorProjectSnapshot[] = [];
	let present = projectTransactions.capture();
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let editPending = false;

	function cancelPendingEdit() {
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = null;
		editPending = false;
	}

	function pushHistory(project: EditorProjectSnapshot) {
		if (undoStack.length >= HISTORY_LIMIT) undoStack.shift();
		undoStack.push(project);
	}

	function commitPendingEdit() {
		const pending = editPending;
		cancelPendingEdit();
		if (!pending) return;

		const current = projectTransactions.capture();
		if (sameProjectSnapshot(current, present)) return;
		pushHistory(present);
		present = current;
	}

	function onProjectChange(change: ProjectChange) {
		// Generated source is outside the authored snapshot.
		if (change.kind === 'generated') return;
		if (change.kind === 'edit' && change.history === 'debounced') {
			redoStack.length = 0;
			editPending = true;
			if (saveTimeout) clearTimeout(saveTimeout);
			saveTimeout = setTimeout(commitPendingEdit, DEBOUNCE_DELAY);
			return;
		}

		cancelPendingEdit();
		if (change.kind === 'replace') {
			undoStack.length = 0;
			redoStack.length = 0;
		} else if (change.kind === 'edit' && change.history === 'checkpoint') {
			pushHistory(present);
			redoStack.length = 0;
		}
		present = projectTransactions.capture();
	}

	function undo() {
		commitPendingEdit();
		const previousState = undoStack.pop();
		if (!previousState) return;
		if (redoStack.length >= HISTORY_LIMIT) redoStack.shift();
		redoStack.push(present);
		projectTransactions.restore(previousState);
	}

	function redo() {
		commitPendingEdit();
		const nextState = redoStack.pop();
		if (!nextState) return;
		pushHistory(present);
		projectTransactions.restore(nextState);
	}

	store.subscribe('projectChange', onProjectChange);
	events.on('undo', undo);
	events.on('redo', redo);
	events.on('beforeProjectEdit', commitPendingEdit);

	return () => {
		cancelPendingEdit();
		undoStack.length = 0;
		redoStack.length = 0;
		store.unsubscribe('projectChange', onProjectChange);
		events.off('undo', undo);
		events.off('redo', redo);
		events.off('beforeProjectEdit', commitPendingEdit);
	};
}

/** Retain authored project history independently for each editor installation. */
export const undoRedoPlugin: EditorPlugin = { id: 'undo-redo', setup };
