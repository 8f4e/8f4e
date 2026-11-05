import type { LoadingIndicator, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

/** Adds one load and returns an idempotent remover for that exact indicator object. */
export function addLoadingIndicator(
	store: Pick<StateManager<State>, 'getState' | 'set'>,
	indicator: LoadingIndicator
): () => void {
	store.set('loadingIndicators', [...store.getState().loadingIndicators, indicator]);
	return () => {
		const indicators = store.getState().loadingIndicators;
		if (indicators.includes(indicator)) {
			store.set(
				'loadingIndicators',
				indicators.filter(current => current !== indicator)
			);
		}
	};
}
