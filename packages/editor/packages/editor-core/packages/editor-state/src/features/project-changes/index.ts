import type { ProjectChange, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';

type ProjectStore = Pick<StateManager<State>, 'getState' | 'set'>;
const restoring = new WeakSet<State>();

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
	const nested = restoring.has(state);
	restoring.add(state);
	try {
		store.set('initialProjectState', project);
	} finally {
		if (!nested) restoring.delete(state);
	}
	if (!nested) publishProjectChange(store, kind);
}
