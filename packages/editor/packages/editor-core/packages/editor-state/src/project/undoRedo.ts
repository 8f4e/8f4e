import type { EditorProjectSnapshot, EventDispatcher, ProjectChange, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { sameProjectSnapshot } from './snapshots';
import type { ProjectTransactionService } from './transactions';

const DEBOUNCE_DELAY = 1000;
const HISTORY_LIMIT = 10;

export default function registerUndoRedo(
	store: StateManager<State>,
	events: EventDispatcher,
	projectTransactions: Pick<ProjectTransactionService, 'capture' | 'restore'>
): () => void {
	const state = store.getState();
	let present = projectTransactions.capture();
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

		const current = projectTransactions.capture();
		if (sameProjectSnapshot(current, present)) return;
		pushHistory(present);
		present = current;
	}

	function onProjectChange(change: ProjectChange) {
		// Generated source is outside the authored snapshot.
		if (change.kind === 'generated') return;
		if (change.kind === 'edit' && change.history === 'debounced') {
			state.redoStack = [];
			editPending = true;
			if (saveTimeout) clearTimeout(saveTimeout);
			saveTimeout = setTimeout(commitPendingEdit, DEBOUNCE_DELAY);
			return;
		}

		cancelPendingEdit();
		if (change.kind === 'replace') {
			state.historyStack = [];
			state.redoStack = [];
		} else if (change.kind === 'edit' && change.history === 'checkpoint') {
			pushHistory(present);
			state.redoStack = [];
		}
		present = projectTransactions.capture();
	}

	function undo() {
		commitPendingEdit();
		const previousState = state.historyStack.pop();
		if (!previousState) return;
		if (state.redoStack.length >= HISTORY_LIMIT) state.redoStack.shift();
		state.redoStack.push(present);
		projectTransactions.restore(previousState);
	}

	function redo() {
		commitPendingEdit();
		const nextState = state.redoStack.pop();
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
		store.unsubscribe('projectChange', onProjectChange);
		events.off('undo', undo);
		events.off('redo', redo);
		events.off('beforeProjectEdit', commitPendingEdit);
	};
}
