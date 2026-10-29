import type { EventDispatcher, ProjectChange, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';

import serializeToProject from '../../pureHelpers/projectSerialization/serializeToProject';
import { restoreProject } from '../project-changes';

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
		present = structuredClone(serializeToProject(state));
	}

	function applyProjectEdit({ project }: { project: ProjectObjectModel }) {
		if (stableStringify(project) === stableStringify(serializeToProject(state))) return;
		// An API batch is its own undo step, after any pending human edit.
		commitPendingEdit();
		restoreProject(store, project, 'checkpoint');
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
	events.on('applyProjectEdit', applyProjectEdit);

	return () => {
		cancelPendingEdit();
		store.unsubscribe('projectChange', onProjectChange);
		events.off('undo', undo);
		events.off('redo', redo);
		events.off('applyProjectEdit', applyProjectEdit);
	};
}
