import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/compiler';
import { createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createSessionPersistencePlugin } from '@8f4e/editor-plugin-session-persistence';
import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { createLazyPluginRegistry } from './lazy-plugins';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.unstubAllGlobals();
});

function restoreSession(directive: string, nested = false) {
	const project = parseProjectSource(
		[
			'8f4e/v1',
			'entry main',
			...(nested ? ['group outer', 'group inner'] : []),
			'module audio',
			'int[] points 4',
			'int value 0',
			'float left 0',
			'float right 0',
			'int[] notes 8',
			'int pressed 0',
			`; @${directive}`,
			'moduleEnd',
			...(nested ? ['groupEnd', 'groupEnd'] : []),
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
		drawers: createEditorDrawerRegistry(),
	};
	const disposeSession = createSessionPersistencePlugin({
		storage,
		storageKey: 'session',
		restoreOnStartup: true,
	}).setup(context);
	const entries = createLazyPluginRegistry({
		navigator: {} as Navigator,
		writeMemory: () => {},
		getMemory: () => null,
		getCodeBuffer: () => new Uint8Array(),
		getAssertionSites: () => undefined,
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
	const outer = state.codeBlockRendering.codeBlocks.find(block => block.name === 'outer');
	const inner = outer?.nestedProjectCodeBlocks?.find(block => block.name === 'inner');
	const blocks = inner?.nestedProjectCodeBlocks ?? state.codeBlockRendering.codeBlocks;
	const block = blocks.find(block => block.name === 'audio')!;
	return { block, entries, state, events, outer, inner };
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

it('loads MIDI from restored raw configuration and registers its schema', async () => {
	const { state, entries } = restoreSession(
		'config midi.inputs.keys.port 0\n; @config midi.inputs.keys.callback onMidi'
	);
	await vi.waitFor(() => expect(state.info.midi).toEqual({}));
	expect(state.editorConfig.midi).toEqual({ inputs: { keys: { port: 0, callback: 'onMidi' } } });
	expect(state.codeErrors.editorDirectiveErrors).toEqual([]);
	expect(entries.filter(entry => entry.load.mock.calls.length).map(entry => entry.id)).toEqual(['midi-input']);
});

it('loads MIDI from unopened groups while deferring plot until its project level is visited', async () => {
	const { block, entries, state, events, outer, inner } = restoreSession(
		'plot &points 4\n; @config midi.inputs.keys.port 0\n; @config midi.inputs.keys.callback onMidi',
		true
	);
	await vi.waitFor(() => expect(state.info.midi).toEqual({}));
	const plot = entries.find(entry => entry.id === 'plot')!;
	expect(plot.load).not.toHaveBeenCalled();
	events.dispatch('openProjectGroup', { codeBlock: outer });
	await Promise.resolve();
	expect(plot.load).not.toHaveBeenCalled();
	events.dispatch('openProjectGroup', { codeBlock: inner });
	await vi.waitFor(() => expect(block.gaps.get(7)?.size).toBe(8));
	events.dispatch('goToRootProjectGroup');
	events.dispatch('openProjectGroup', { codeBlock: outer });
	events.dispatch('openProjectGroup', { codeBlock: inner });
	await Promise.resolve();
	expect(plot.load).toHaveBeenCalledOnce();
});

it('loads binary assets from a restored session and announces their size as compiler input', async () => {
	const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4, 5, 6])));
	vi.stubGlobal('fetch', fetch);
	vi.stubGlobal('caches', undefined);
	const { state, entries } = restoreSession(
		'config bin.sound.url https://example.com/lazy.pcm\n; @config bin.sound.memory audio:points'
	);
	const revision = state.compilerInputRevision;
	await vi.waitFor(() =>
		expect(state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'env')!.code).toContain(
			'const ASSET_SOUND_SIZE 6'
		)
	);
	expect(state.compilerInputRevision).toBeGreaterThan(revision);
	expect(state.codeErrors.editorDirectiveErrors).toEqual([]);
	expect(fetch).toHaveBeenCalledExactlyOnceWith('https://example.com/lazy.pcm');
	expect(entries.filter(entry => entry.load.mock.calls.length).map(entry => entry.id)).toEqual(['binary-assets']);
});

it.each([
	['raw configuration', 'config textureRuntime.enabled true'],
	['a texture directive', 'texture points mono 2 2 2'],
])('loads the texture runtime from %s in an unopened group', async (_label, directive) => {
	const { state, entries } = restoreSession(directive, true);
	await vi.waitFor(() => {
		expect(state.editorConfigSchemaContributions.textureRuntime).toBeDefined();
		expect(state.codeErrors.editorDirectiveErrors).toEqual([]);
	});
	expect(entries.find(entry => entry.id === 'texture-runtime')!.load).toHaveBeenCalledOnce();
	expect(entries.filter(entry => entry.load.mock.calls.length).map(entry => entry.id)).toEqual(['texture-runtime']);
});
