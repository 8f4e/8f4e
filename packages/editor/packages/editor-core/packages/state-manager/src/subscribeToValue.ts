import { createSubscribe } from './subscribe.js';

import type { Matcher, Path, PathValue, Subscription } from './types';

export function createSubscribeToValue<State>(subscriptions: Set<Subscription<State>>) {
	const subscribe = createSubscribe(subscriptions);

	return function subscribeToValue<P extends Path<State>>(
		selector: P,
		matcher: Matcher<PathValue<State, P>>,
		callback: (value: PathValue<State, P>) => void
	) {
		const subscription = subscribe(selector, callback);
		subscription.matcher = matcher;
		return subscription;
	};
}
