import { EventEmitter } from 'node:events';
import type { EventDispatcher } from '@8f4e/editor-state-types';

/** For state integration tests that need ordinary event ordering and consumed pointer events. */
export function createFifoEventDispatcher(): EventDispatcher {
	const emitter = new EventEmitter();
	return {
		on: emitter.on.bind(emitter),
		off: emitter.off.bind(emitter),
		dispatch: (name, ...[event]) => {
			for (const listener of emitter.listeners(name)) {
				if ((event as { stopPropagation?: boolean } | undefined)?.stopPropagation) return;
				listener(event);
			}
		},
	};
}
