import { EventEmitter } from 'node:events';
import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import type { EventDispatcher } from '@8f4e/editor-state-types';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, vi } from 'vitest';
import { createTouchViewportNavigationPlugin } from '../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

export function setup(viewportDragging = true) {
	const inputTarget = Object.assign(new EventTarget(), { style: { touchAction: 'pan-y' } }) as unknown as HTMLElement;
	const emitter = new EventEmitter();
	const events: EventDispatcher = {
		on: (name, callback, options) => {
			if (options?.capture) emitter.prependListener(name, callback);
			else emitter.on(name, callback);
		},
		off: emitter.off.bind(emitter),
		dispatch: emitter.emit.bind(emitter),
	};
	const store = initState(events, { callbacks: {}, featureFlags: { viewportDragging } });
	events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
	const changed = vi.fn();
	events.on('viewportChanged', changed);
	const dispose = createTouchViewportNavigationPlugin({ inputTarget }).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
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
