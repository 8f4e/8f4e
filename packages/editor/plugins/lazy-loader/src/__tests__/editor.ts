import { parseProjectSource } from '@8f4e/compiler';
import type { EditorPluginContext } from '@8f4e/editor-core';
import initState from '@8f4e/editor-state';
import type { EventDispatcher } from '@8f4e/editor-state-types';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { afterEach } from 'vitest';
import { createLazyPluginLoaderPlugin, type LazyEditorPlugin } from '../index';

export const emptySource = '8f4e/v1\nentry main\nmodule audio\nmoduleEnd\nentryEnd';
export const matchingSource = emptySource.replace('moduleEnd', '; @custom\nmoduleEnd');

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

export function setup(plugins: readonly LazyEditorPlugin[], initialSource?: string) {
	const listeners = new Map<string, Set<(event: unknown) => void>>();
	const events: EventDispatcher = {
		on: (name, listener) => {
			if (!listeners.has(name)) listeners.set(name, new Set());
			listeners.get(name)!.add(listener as (event: unknown) => void);
		},
		off: (name, listener) => {
			listeners.get(name)?.delete(listener as (event: unknown) => void);
		},
		dispatch: (name, event) => {
			for (const listener of listeners.get(name) ?? []) listener(event);
		},
	};
	const store = initState(events, { callbacks: {}, runtimeRegistry: {}, initialEditorMode: 'edit' });
	cleanups.push(store.dispose);
	const load = (source: string) => events.dispatch('loadProject', { project: parseProjectSource(source) });
	if (initialSource) load(initialSource);
	const context: EditorPluginContext = {
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		drawers: createCodeBlockDrawerRegistry(),
	};
	const dispose = createLazyPluginLoaderPlugin(plugins).setup(context);
	cleanups.push(dispose);
	const state = store.getState();
	const openMenu = async () => {
		events.dispatch('contextmenu', { x: 10000, y: 10000 });
		await Promise.resolve();
		return state.contextMenu.items;
	};
	return { ...context, state, load, dispose, openMenu };
}
