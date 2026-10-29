import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/compiler';
import { createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createSessionPersistencePlugin } from '@8f4e/editor-plugin-session-persistence';
import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { createLazyPluginRegistry } from './lazy-plugins';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function restoreSession(directive: string) {
	const project = parseProjectSource(
		[
			'8f4e/v1',
			'entry main',
			'module audio',
			'int[] points 4',
			'int value 0',
			'float left 0',
			'float right 0',
			'int[] notes 8',
			'int pressed 0',
			`; @${directive}`,
			'moduleEnd',
			'entryEnd',
		].join('\n')
	);
	const storage = { getItem: () => JSON.stringify(project), setItem: vi.fn() };
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	const context = {
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		drawers: createCodeBlockDrawerRegistry(),
	};
	const disposeSession = createSessionPersistencePlugin({
		storage,
		storageKey: 'session',
		restoreOnStartup: true,
	}).setup(context);
	const entries = createLazyPluginRegistry({
		writeMemory: () => {},
		getMemory: () => null,
		getCodeBuffer: () => new Uint8Array(),
		getAssertionSites: () => undefined,
		browser: {} as Window & typeof globalThis,
	}).map(entry => ({
		...entry,
		load: vi.fn(entry.load),
	}));
	const disposeLoader = createLazyPluginLoaderPlugin(entries).setup(context);
	cleanups.push(() => {
		disposeLoader();
		disposeSession();
		store.dispose();
	});
	events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
	for (const entry of entries) expect(entry.load).not.toHaveBeenCalled();
	events.dispatch('init');
	const state = store.getState();
	const block = state.codeBlockRendering.codeBlocks.find(block => block.name === 'audio')!;
	return { block, entries };
}

it.each([
	['plot &points 4', 'plot', 8],
	['wave &points 4', 'wave', 2],
	['wave2 &points 4', 'wave', 4],
	['wave4 &points 4', 'wave', 8],
	['meter &value', 'meter', 1],
	['bars &points 4', 'bars', 8],
	['piano &notes &pressed 48', 'piano', 6],
	['slider &value 0 100 1', 'slider', 2],
	['crossfade &left &right', 'crossfade', 2],
] as const)('loads %s after session restoration and refreshes its layout', async (directive, plugin, rows) => {
	const { block, entries } = restoreSession(directive);
	await vi.waitFor(() => expect(block.gaps.get(7)?.size).toBe(rows));
	expect(entries.filter(entry => entry.load.mock.calls.length).map(entry => entry.id)).toEqual([plugin]);
});
