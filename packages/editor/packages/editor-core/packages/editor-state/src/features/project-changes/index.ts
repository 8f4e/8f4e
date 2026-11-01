import type { ProjectChange, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';

type ProjectStore = Pick<StateManager<State>, 'getState' | 'set'>;
const restoring = new WeakMap<State, Exclude<ProjectChange['kind'], 'edit'>>();

export function isRestoringProjectEdit(state: State): boolean {
	const kind = restoring.get(state);
	return kind === 'checkpoint' || kind === 'restore';
}

/** Publish once after a completed persisted edit and its derived state have been updated. */
export function publishProjectChange(store: ProjectStore, kind: ProjectChange['kind'] = 'edit'): void {
	const state = store.getState();
	if (restoring.has(state)) return;
	store.set('projectChange', { revision: state.projectChange.revision + 1, kind });
}

/** Restore the whole snapshot before announcing it, including any regenerated environment constants. */
export function restoreProject(
	store: ProjectStore,
	project: ProjectObjectModel,
	kind: Exclude<ProjectChange['kind'], 'edit'>
): void {
	const state = store.getState();
	const previousKind = restoring.get(state);
	restoring.set(state, kind);
	try {
		store.set('initialProjectState', project);
		if (kind === 'replace') store.set('editorMode', state.globalEditorDirectives.mode ?? 'view');
	} finally {
		if (previousKind) restoring.set(state, previousKind);
		else restoring.delete(state);
	}
	if (!previousKind) publishProjectChange(store, kind);
}
