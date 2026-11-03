import type { State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

/** Call after updating compiler inputs and their derived state, never for selection or visual metadata updates. */
export default function incrementCompilerInputRevision(store: Pick<StateManager<State>, 'getState' | 'set'>): void {
	store.set('compilerInputRevision', store.getState().compilerInputRevision + 1);
}
