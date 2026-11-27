import type { Path, PathValue, Subscription } from './types';

export function createUnsubscribe<State>(subscriptions: Set<Subscription<State>>) {
	return function unsubscribe<P extends Path<State>>(selector: P, callback: (value: PathValue<State, P>) => void) {
		for (const subscription of subscriptions) {
			if (subscription.selector === selector && subscription.callback === callback) {
				subscriptions.delete(subscription);
			}
		}
	};
}
