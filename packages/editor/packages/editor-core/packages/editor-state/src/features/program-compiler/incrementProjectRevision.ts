import type { State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

/** Call after completing a change to persisted project content, never for selection, caret, or navigation updates. */
export default function incrementProjectRevision(store: Pick<StateManager<State>, 'getState' | 'set'>): void {
	store.set('projectRevision', store.getState().projectRevision + 1);
}
