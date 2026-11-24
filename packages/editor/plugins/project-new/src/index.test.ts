import { EventEmitter } from 'node:events';
import type { EditorPluginContext } from '@8f4e/editor-core';
import initState, { EMPTY_DEFAULT_PROJECT, serializeToProject } from '@8f4e/editor-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newProjectPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	cleanups.push(store.dispose);
	const project = { ...EMPTY_DEFAULT_PROJECT, notes: [{ id: 0, code: ['note existing', 'noteEnd'] }] };
	events.dispatch('loadProject', { project });
	const openMenu = async () => {
		await events.dispatch('contextmenu', { x: 100, y: 112 });
		return state.contextMenu.items;
	};
	const install = () =>
		newProjectPlugin.setup({
			store,
			events,
			menus: store.menus,
			directives: store.directives,
			layout: store.layout,
			loading: store.loading,
			renderRegistry: {} as EditorPluginContext['renderRegistry'],
		});
	return { state, events, openMenu, install };
}

describe('project creation', () => {
	it('contributes the New Project menu in edit mode only when installed', async () => {
		const test = setup();
		test.events.dispatch('enterEditMode');
		expect(await test.openMenu()).toEqual([]);
		const before = serializeToProject(test.state);
		test.events.dispatch('new');
		expect(serializeToProject(test.state)).toEqual(before);
		const dispose = test.install();
		cleanups.push(dispose);
		expect(await test.openMenu()).toEqual([{ title: 'New Project', action: 'new', close: true }]);
		test.events.dispatch('exitToViewMode');
		expect(await test.openMenu()).toEqual([]);
	});

	it('activates a menu action that loads an empty project through core', async () => {
		const test = setup();
		cleanups.push(test.install());
		const loaded = vi.fn();
		test.events.on('loadProject', loaded);
		test.events.dispatch('enterEditMode');
		const menu = await test.openMenu();
		test.events.dispatch('activateContextMenuItem', {
			index: menu.findIndex(item => item.action === 'new'),
			x: 100,
			y: 112,
		});
		expect(loaded).toHaveBeenCalledExactlyOnceWith({ project: EMPTY_DEFAULT_PROJECT });
		expect(serializeToProject(test.state)).toMatchObject({
			...EMPTY_DEFAULT_PROJECT,
			constants: expect.any(Array),
		});
		expect(test.state.contextMenu.open).toBe(false);
		expect(test.state.editorMode).toBe('view');
	});

	it('removes both the contribution and action on disposal', async () => {
		const test = setup();
		const dispose = test.install();
		test.events.dispatch('enterEditMode');
		dispose();
		expect(await test.openMenu()).toEqual([]);
		const before = serializeToProject(test.state);
		test.events.dispatch('new');
		expect(serializeToProject(test.state)).toEqual(before);
	});
});
