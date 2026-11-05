import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import type { EventDispatcher, EventSubscriptionOptions } from '@8f4e/editor-state-types';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, vi } from 'vitest';
import { createTouchInputPlugin, type TouchInputOptions } from '../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

export function setup(viewportDragging = true, axis?: TouchInputOptions['axis']) {
	const inputTarget = Object.assign(new EventTarget(), {
		style: { touchAction: 'pan-y' },
		getBoundingClientRect: () => ({ left: 0, top: 0 }),
		clientWidth: 640,
		clientHeight: 480,
	}) as unknown as HTMLElement;
	const listeners = new Map<string, Array<{ callback: (event: unknown) => void; capture: boolean }>>();
	const events: EventDispatcher = {
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
	const store = initState(events, { callbacks: {}, featureFlags: { viewportDragging } });
	events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
	const changed = vi.fn();
	events.on('viewportChanged', changed);
	const dispose = createTouchInputPlugin({ inputTarget, axis }).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		drawers: createEditorDrawerRegistry(),
	});
	cleanups.push(store.dispose, dispose);
	const touch = (type: string, points: Array<{ clientX: number; clientY: number }> = []) => {
		const event = Object.assign(new Event(type, { cancelable: type !== 'touchcancel' }), { touches: points });
		inputTarget.dispatchEvent(event);
		return event;
	};
	return { state: store.getState(), store, events, inputTarget, touch, changed, dispose };
}

export const finger = (clientX: number, clientY: number) => ({ clientX, clientY });
