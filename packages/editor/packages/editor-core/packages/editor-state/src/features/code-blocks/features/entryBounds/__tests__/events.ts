import type { EventDispatcher } from '@8f4e/editor-state-types';

export function createEvents(): EventDispatcher {
	const listeners = new Map<string, Array<(event: unknown) => void>>();
	return {
		on: (name, callback) => {
			if (!listeners.has(name)) listeners.set(name, []);
			listeners.get(name)!.push(callback as (event: unknown) => void);
		},
		off: (name, callback) => {
			listeners.set(
				name,
				(listeners.get(name) ?? []).filter(item => item !== callback)
			);
		},
		dispatch: (name, event) => {
			for (const callback of listeners.get(name) ?? []) callback(event);
		},
	};
}
