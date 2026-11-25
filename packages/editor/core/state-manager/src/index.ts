import { createSet } from './set.js';
import { createSubscribe } from './subscribe.js';
import { createSubscribeToValue } from './subscribeToValue.js';
import type { Matcher, Path, PathValue, Subscription } from './types';
import { createUnsubscribe } from './unsubscribe.js';

export interface StateManager<State> {
	getState: () => State;
	set: <P extends Path<State>>(selector: P, value: PathValue<State, P>) => void;
	subscribe: <P extends Path<State>>(
		selector: P,
		callback: (value: PathValue<State, P>) => void
	) => Subscription<State, P>;
	subscribeToValue: <P extends Path<State>>(
		selector: P,
		matcher: Matcher<PathValue<State, P>>,
		callback: (value: PathValue<State, P>) => void
	) => Subscription<State, P>;
	unsubscribe: <P extends Path<State>>(selector: P, callback: (value: PathValue<State, P>) => void) => void;
	dispose: () => void;
}

function createStateManager<State>(state: State): StateManager<State> {
	const subscriptions = new Set<Subscription<State>>();

	const set = createSet(state, subscriptions);
	const subscribe = createSubscribe(subscriptions);
	const subscribeToValue = createSubscribeToValue(subscriptions);
	const unsubscribe = createUnsubscribe(subscriptions);

	return {
		getState: () => state,
		set,
		subscribe,
		subscribeToValue,
		unsubscribe,
		dispose: () => subscriptions.clear(),
	};
}

export default createStateManager;
