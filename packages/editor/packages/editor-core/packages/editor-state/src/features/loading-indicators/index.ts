import type { EditorLoadingRegistry, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

/** Keeps contribution identity private, including when the same input object is reused. */
export function createLoadingRegistry(store: Pick<StateManager<State>, 'getState' | 'set'>): EditorLoadingRegistry {
	return {
		add: indicator => {
			const entry = { ...indicator };
			store.set('loadingIndicators', [...store.getState().loadingIndicators, entry]);
			let removed = false;
			return () => {
				if (removed) return;
				removed = true;
				store.set(
					'loadingIndicators',
					store.getState().loadingIndicators.filter(current => current !== entry)
				);
			};
		},
	};
}
