import { tokenizeSelector } from './tokenizeSelector.js';

import type { Path, PathValue, Subscription } from './types';

export function createSubscribe<State>(subscriptions: Set<Subscription<State>>) {
	return function subscribe<P extends Path<State>>(selector: P, callback: (value: PathValue<State, P>) => void) {
		const tokens = tokenizeSelector(selector);

		const subscription: Subscription<State, P> = {
			selector,
			tokens,
			callback,
		};
		subscriptions.add(subscription as unknown as Subscription<State>);
		return subscription;
	};
}
