import type { EventDispatcher } from '@8f4e/editor-core';

export function createEvents(): EventDispatcher {
	const listeners = new Map<string, Array<{ callback: (event: unknown) => void; capture: boolean }>>();
	return {
		on: (name, callback, options = {}) => {
			if (!listeners.has(name)) listeners.set(name, []);
			listeners.get(name)!.push({ callback: callback as (event: unknown) => void, capture: options.capture ?? false });
		},
		off: (name, callback) => {
			listeners.set(
				name,
				(listeners.get(name) ?? []).filter(item => item.callback !== callback)
			);
		},
		dispatch: (name, event) => {
			for (const capture of [true, false]) {
				for (const item of listeners.get(name) ?? []) {
					if (item.capture !== capture) continue;
					if ((event as { stopPropagation?: boolean } | undefined)?.stopPropagation) return;
					item.callback(event);
				}
			}
		},
	};
}
