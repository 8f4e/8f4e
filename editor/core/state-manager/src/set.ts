import { getValueByTokens } from './getValueByPath.js';
import { tokenizeSelector } from './tokenizeSelector.js';

import type { Path, PathValue, Subscription } from './types';

export function createSet<State>(state: State, subscriptions: Set<Subscription<State>>) {
	return function set<P extends Path<State>>(selector: P, value: PathValue<State, P>) {
		const keys = tokenizeSelector(selector);
		let current: any = state;

		if (keys.length === 1) {
			current[keys[0]] = value;
		} else {
			for (let i = 0; i < keys.length - 1; i++) {
				current = current[keys[i]];
			}
			current[keys[keys.length - 1]] = value;
		}

		subscriptions.forEach(subscription => {
			const { tokens, callback, matcher } = subscription;
			const comparisonLength = Math.min(tokens.length, keys.length);

			for (let i = 0; i < comparisonLength; i++) {
				if (tokens[i] !== keys[i]) {
					return;
				}
			}

			const target = getValueByTokens(state, tokens);

			if ('matcher' in subscription) {
				let matches: boolean;

				if (typeof matcher === 'function') {
					// If the matcher is the same function reference as the target, treat it as a value matcher.
					// Otherwise, treat the matcher as a predicate function.
					matches = target === matcher ? true : (matcher as (value: unknown) => boolean)(target);
				} else {
					matches = target === matcher;
				}

				if (!matches) {
					return;
				}
			}

			(callback as (value: unknown) => void)(target);
		});
	};
}
