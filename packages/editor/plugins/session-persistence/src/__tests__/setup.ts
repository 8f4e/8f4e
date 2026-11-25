import { EventEmitter } from 'node:events';
import type { EditorPlugin } from '@8f4e/editor-core';
import { undoRedoPlugin } from '@8f4e/editor-plugin-undo-redo';
import initState, { setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import { createEditorRenderRegistry } from '@8f4e/web-ui';

export function setupPlugin(plugin: EditorPlugin) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	events.dispatch('enterEditMode');
	const context = {
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		renderRegistry: createEditorRenderRegistry(),
	};
	const disposeHistory = undoRedoPlugin.setup(context);
	const disposePlugin = plugin.setup(context);
	return {
		store,
		state: store.getState(),
		events,
		disposePlugin,
		dispose: () => {
			disposePlugin();
			disposeHistory();
			store.dispose();
		},
	};
}
