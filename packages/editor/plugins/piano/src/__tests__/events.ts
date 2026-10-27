import type { EventDispatcher } from '@8f4e/editor-state-types';

export function createEvents(): EventDispatcher {
	const listeners = new Map<string, Set<(event: unknown) => void>>();
	return {
		on: (name, listener) => {
			if (!listeners.has(name)) listeners.set(name, new Set());
			listeners.get(name)!.add(listener as (event: unknown) => void);
		},
		off: (name, listener) => {
			listeners.get(name)?.delete(listener as (event: unknown) => void);
		},
		dispatch: (name, event) => {
			for (const listener of listeners.get(name) ?? []) {
				if ((event as { stopPropagation?: boolean } | undefined)?.stopPropagation) break;
				listener(event);
			}
		},
	};
}
