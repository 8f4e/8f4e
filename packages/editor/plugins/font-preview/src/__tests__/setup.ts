import { EventEmitter } from 'node:events';
import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import type { EventDispatcher } from '@8f4e/editor-state-types';
import { FONT_NAMES, type Font } from '@8f4e/sprite-generator';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach } from 'vitest';
import { createFontPreviewPlugin } from '../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

export function project(font = FONT_NAMES[0]) {
	return {
		...EMPTY_DEFAULT_PROJECT,
		notes: [{ id: 0, code: ['note settings', `; @config font ${font}`, 'noteEnd'] }],
	};
}

export function setup(defaultFont?: Font) {
	const inputTarget = new EventTarget() as HTMLElement;
	const emitter = new EventEmitter();
	const events: EventDispatcher = {
		on: (name, callback, options) => {
			if (options?.capture) emitter.prependListener(name, callback);
			else emitter.on(name, callback);
		},
		off: emitter.off.bind(emitter),
		dispatch: emitter.emit.bind(emitter),
	};
	// This fixture supplies a generic string setting. Font validation belongs to web-ui.
	const store = initState(events, {
		callbacks: {},
		editorConfigSchemaContributions: { font: { root: 'font', schema: { type: 'string' } } },
	});
	events.dispatch('loadProject', { project: project() });
	const disposePlugin = createFontPreviewPlugin({ inputTarget, defaultFont }).setup({
		store,
		events,
		drawers: createEditorDrawerRegistry(),
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
	});
	cleanups.push(store.dispose, disposePlugin);
	const key = (key: string, options: KeyboardEventInit = {}, prevented = false) => {
		const event = Object.assign(new Event('keydown', { cancelable: true }), { key, ...options });
		if (prevented) event.preventDefault();
		inputTarget.dispatchEvent(event);
		return event;
	};
	return { state: store.getState(), store, events, key, disposePlugin };
}
