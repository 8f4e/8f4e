import { EventEmitter } from 'node:events';
import type { EditorPlugin } from '@8f4e/editor-core';
import initState from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';

export function setupPlugins(plugins: EditorPlugin[]) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, runtimeRegistry: {}, initialEditorMode: 'edit' });
	const disposers = plugins.map(plugin =>
		plugin.setup({
			store,
			events,
			menus: store.menus,
			directives: store.directives,
			drawers: createCodeBlockDrawerRegistry(),
		})
	);
	const disposePlugin = () => {
		while (disposers.length) disposers.pop()!();
	};
	return {
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
