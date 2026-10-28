import type { EventDispatcher } from '@8f4e/editor-core';

export function createEvents(): EventDispatcher & { dispatchAsync: (name: string, event?: unknown) => Promise<void> } {
	const listeners = new Map<string, Array<{ callback: (event: unknown) => unknown; capture: boolean }>>();
	function dispatch(name: string, event: unknown) {
		const pending: unknown[] = [];
		for (const capture of [true, false]) {
			for (const item of listeners.get(name) ?? []) {
				if (item.capture !== capture) continue;
				if ((event as { stopPropagation?: boolean } | undefined)?.stopPropagation) return pending;
				pending.push(item.callback(event));
			}
		}
		return pending;
	}
	return {
		on: (name, callback, options = {}) => {
			if (!listeners.has(name)) listeners.set(name, []);
			listeners
				.get(name)!
				.push({ callback: callback as (event: unknown) => unknown, capture: options.capture ?? false });
		},
		off: (name, callback) => {
			listeners.set(
				name,
				(listeners.get(name) ?? []).filter(item => item.callback !== callback)
			);
		},
		dispatch: (name, event) => {
			dispatch(name, event);
		},
		dispatchAsync: async (name, event) => {
			await Promise.all(dispatch(name, event));
		},
	};
}
