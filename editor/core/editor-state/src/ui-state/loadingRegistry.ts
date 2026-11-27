import type { EditorLoadingRegistry, LoadingIndicator, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

/** Each handle owns one attempt; reusing an ID replaces it without transferring ownership. */
export function createLoadingRegistry(store: Pick<StateManager<State>, 'getState' | 'set'>): EditorLoadingRegistry {
	return {
		add: indicator => {
			const entry: LoadingIndicator = {
				id: indicator.id,
				message: indicator.message,
				status: 'loading',
				startedAt: Date.now(),
				finishedAt: null,
			};
			const indicators = store.getState().loadingIndicators;
			const index = indicators.findIndex(current => current.id === entry.id);
			store.set(
				'loadingIndicators',
				index === -1
					? [...indicators, entry]
					: indicators.map((current, position) => (position === index ? entry : current))
			);
			const finish = (status: 'done' | 'failed' | 'cancelled') => {
				const current = store.getState().loadingIndicators;
				if (entry.status !== 'loading' || !current.includes(entry)) return;
				entry.status = status;
				entry.finishedAt = Date.now();
				store.set('loadingIndicators', [...current]);
			};
			return { done: () => finish('done'), fail: () => finish('failed'), cancel: () => finish('cancelled') };
		},
	};
}
