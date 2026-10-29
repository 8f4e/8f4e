import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';

import serializeToProject from '../../pureHelpers/projectSerialization/serializeToProject';

const DEBOUNCE_DELAY = 1000;
const HISTORY_LIMIT = 10;

/**
 * Serializes a project snapshot with sorted object keys, so snapshots produced
 * by different code paths (serializer, project parser, test fixtures) compare
 * by content rather than by key insertion order.
 */
function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value) ?? 'null';
	}

	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(',')}]`;
	}

	const record = value as Record<string, unknown>;
	const entries = Object.keys(record)
		.filter(key => record[key] !== undefined)
		.sort()
		.map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
	return `{${entries.join(',')}}`;
}

export default function historyTracking(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();
	// Serialization shares live code arrays; retain independent before/after snapshots.
	let present = structuredClone(serializeToProject(state));
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let editPending = false;
	let restoring = false;

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

		const current = structuredClone(serializeToProject(state));
		if (stableStringify(current) === stableStringify(present)) return;
		pushHistory(present);
		present = current;
	}

	function onProjectChange() {
		if (restoring || !state.featureFlags.historyTracking) return;
		state.redoStack = [];
		editPending = true;
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(commitPendingEdit, DEBOUNCE_DELAY);
	}

	function restoreProject(project: ProjectObjectModel) {
		restoring = true;
		try {
			store.set('initialProjectState', project);
		} finally {
			restoring = false;
		}
	}

	function applyProjectEdit({ project }: { project: ProjectObjectModel }) {
		if (stableStringify(project) === stableStringify(serializeToProject(state))) return;
		// An API batch is its own undo step, after any pending human edit.
		commitPendingEdit();
		if (state.featureFlags.historyTracking) {
			pushHistory(structuredClone(serializeToProject(state)));
			state.redoStack = [];
		}
		restoreProject(project);
	}

	function resetHistory() {
		cancelPendingEdit();
		state.historyStack = [];
		state.redoStack = [];
	}

	function undo() {
		if (!state.featureFlags.historyTracking) return;
		commitPendingEdit();
		const previousState = state.historyStack.pop();
		if (!previousState) return;
		if (state.redoStack.length >= HISTORY_LIMIT) state.redoStack.shift();
		state.redoStack.push(present);
		restoreProject(previousState);
	}

	function redo() {
		if (!state.featureFlags.historyTracking) return;
		commitPendingEdit();
		const nextState = state.redoStack.pop();
		if (!nextState) return;
		pushHistory(present);
		restoreProject(nextState);
	}

	function onProjectLoaded() {
		cancelPendingEdit();
		// Capture the rendered project, including normalized/generated blocks.
		present = structuredClone(serializeToProject(state));
	}

	store.subscribe('projectRevision', onProjectChange);
	store.subscribe('initialProjectState', onProjectLoaded);
	events.on('undo', undo);
	events.on('redo', redo);
	events.on('applyProjectEdit', applyProjectEdit);
	events.on('loadProject', resetHistory, { capture: true });

	return () => {
		cancelPendingEdit();
		store.unsubscribe('projectRevision', onProjectChange);
		store.unsubscribe('initialProjectState', onProjectLoaded);
		events.off('undo', undo);
		events.off('redo', redo);
		events.off('applyProjectEdit', applyProjectEdit);
		events.off('loadProject', resetHistory);
	};
}
