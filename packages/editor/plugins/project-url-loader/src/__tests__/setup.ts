import { EventEmitter } from 'node:events';
import type { EditorPlugin } from '@8f4e/editor-core';
import initState from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';

export function setupPlugin(plugin: EditorPlugin) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	events.dispatch('enterEditMode');
	const disposePlugin = plugin.setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		drawers: createCodeBlockDrawerRegistry(),
	});
	const dispatchAsync = async (name: string, payload?: unknown) => {
		await Promise.all(emitter.listeners(name).map(listener => listener(payload)));
	};
	return {
		dispatchAsync,
		store,
		state: store.getState(),
		events,
		disposePlugin,
		dispose: () => {
			disposePlugin();
			store.dispose();
		},
	};
}
