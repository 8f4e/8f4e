import type { EventDispatcher, EventSubscriptionOptions } from '@8f4e/editor-state-types';

export function createEvents(): EventDispatcher {
	const listeners = new Map<string, Array<{ callback: (event: unknown) => void; capture: boolean }>>();
	return {
		on: (name, callback, options: EventSubscriptionOptions = {}) => {
			if (!listeners.has(name)) listeners.set(name, []);
			listeners.get(name)!.push({ callback: callback as (event: unknown) => void, capture: options.capture ?? false });
		},
		off: (name, callback) => {
			listeners.set(
				name,
				(listeners.get(name) ?? []).filter(item => item.callback !== callback)
			);
		},
		dispatch: (name, event, options = {}) => {
			for (const capture of [true, false]) {
				if (options.phase && capture !== (options.phase === 'capture')) continue;
				for (const item of listeners.get(name) ?? []) {
					if (item.capture !== capture) continue;
					if ((event as { stopPropagation?: boolean } | undefined)?.stopPropagation) return;
					item.callback(event);
				}
			}
		},
	};
}
