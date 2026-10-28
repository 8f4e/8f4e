import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';

import serializeToProject from '../../pureHelpers/projectSerialization/serializeToProject';

export default function historyTracking(store: StateManager<State>, events: EventDispatcher): void | (() => void) {
	const state = store.getState();
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let restoring = false;
	const DEBOUNCE_DELAY = 1000;
	// Typing may have queued a history snapshot. If that timer fires after an API edit,
	// it records the already-edited project, so the next Undo restores the same state.
	// Cancel it before recording an explicit checkpoint or resetting project history.
	const cancelPendingHistorySnapshot = () => {
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = null;
	};
	const restore = (project: ProjectObjectModel) => {
		restoring = true;
		try {
			store.set('initialProjectState', project);
		} finally {
			restoring = false;
		}
	};
	const applyProjectEdit = ({ project }: { project: ProjectObjectModel }) => {
		cancelPendingHistorySnapshot();
		if (state.featureFlags.historyTracking) saveHistory();
		restore(project);
	};
	const resetHistory = () => {
		cancelPendingHistorySnapshot();
		state.historyStack = [];
		state.redoStack = [];
	};

	function saveHistory() {
		if (state.historyStack.length >= 10) {
			state.historyStack.shift();
		}

		state.historyStack.push(structuredClone(serializeToProject(state)));
		state.redoStack = [];
	}

	function onCodeChange() {
		if (restoring || !state.featureFlags.historyTracking) return;
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		saveTimeout = setTimeout(() => {
			saveHistory();
			saveTimeout = null;
		}, DEBOUNCE_DELAY);
	}

	function undo() {
		if (!state.featureFlags.historyTracking) return;
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}

		const previousState = state.historyStack.pop();
		if (previousState) {
			if (state.redoStack.length >= 10) {
				state.redoStack.shift();
			}
			state.redoStack.push(structuredClone(serializeToProject(state)));
			restore(previousState);
		}
	}

	function redo() {
		if (!state.featureFlags.historyTracking) return;
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}

		const nextState = state.redoStack.pop();
		if (nextState) {
			if (state.historyStack.length >= 10) {
				state.historyStack.shift();
			}
			state.historyStack.push(structuredClone(serializeToProject(state)));
			restore(nextState);
		}
	}

	store.subscribe('codeBlockRendering.selectedCodeBlock.code', onCodeChange);
	events.on('undo', undo);
	events.on('redo', redo);
	events.on('applyProjectEdit', applyProjectEdit);
	events.on('loadProject', resetHistory, { capture: true });

	return () => {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		store.unsubscribe('codeBlockRendering.selectedCodeBlock.code', onCodeChange);
		events.off('undo', undo);
		events.off('redo', redo);
		events.off('applyProjectEdit', applyProjectEdit);
		events.off('loadProject', resetHistory);
	};
}
