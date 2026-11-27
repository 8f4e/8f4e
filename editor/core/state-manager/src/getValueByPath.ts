import { tokenizeSelector } from './tokenizeSelector.js';

import type { Path, PathValue } from './types';

/**
 * Retrieves a value from the state object by following a dot-separated path.
 * @param state The root state object
 * @param selector The path selector (e.g., 'settings.theme' or 'user.name')
 * @returns The value at the path, or undefined if not found
 */
export function getValueByPath<State, P extends Path<State>>(state: State, selector: P): PathValue<State, P> {
	return getValueByTokens(state, tokenizeSelector(selector)) as PathValue<State, P>;
}

export function getValueByTokens(state: unknown, tokens: readonly string[]): unknown {
	let currentValue: unknown = state;

	for (const token of tokens) {
		if (currentValue === null) {
			currentValue = undefined;
			break;
		}

		if (typeof currentValue === 'object' || typeof currentValue === 'function') {
			currentValue = (currentValue as Record<string, unknown>)[token];
		} else {
			currentValue = undefined;
			break;
		}
	}

	return currentValue;
}
