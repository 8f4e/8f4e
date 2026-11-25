import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/compiler';
import initState, {
	createEditorCommandApi,
	EMPTY_DEFAULT_PROJECT,
	getEditorBlockId,
	setGridSize,
} from '@8f4e/editor-state';
import { getProjectModules } from '@8f4e/language-spec';
import { createEditorRenderRegistry } from '@8f4e/web-ui';
import { expect, it, vi } from 'vitest';
import { createDefaultEditorPlugins } from './index';

it('prioritizes the initial URL over the saved session and keeps autosaving while fetching', async () => {
	const source = '8f4e/v1\nentry main\nmodule remote\nint[] points 4\n; @plot &points 4\nmoduleEnd\nentryEnd';
	let saved = JSON.stringify(parseProjectSource('8f4e/v1\nentry main\nmodule oldSession\nmoduleEnd\nentryEnd'));
	const storage = {
		getItem: vi.fn(() => saved),
		setItem: vi.fn((_key: string, value: string) => {
			saved = value;
		}),
	};
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const fetch = vi.fn<typeof globalThis.fetch>(() => pending);
	vi.stubGlobal('fetch', fetch);
	const browserWindow = { navigator: {}, matchMedia: () => ({ matches: false }) };
	vi.stubGlobal('window', browserWindow);
	const canvas = Object.assign(new EventTarget(), {
		ownerDocument: { defaultView: browserWindow },
	}) as HTMLCanvasElement;
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	events.dispatch('enterEditMode');
	const renderRegistry = createEditorRenderRegistry();
	const disposers: Array<() => void> = [];
	try {
		const plugins = createDefaultEditorPlugins({
			canvas,
			storage: storage as Storage,
			storageKey: 'session',
			initialProjectUrl: 'https://example.com/project.8f4e',
			renderFrame: () => {},
			writeMemory: () => {},
			getMemory: () => null,
			getCodeBuffer: () => new Uint8Array(),
			getAssertionSites: () => undefined,
		});
		for (const plugin of plugins) {
			disposers.push(
				plugin.setup({
					store,
					events,
					menus: store.menus,
					directives: store.directives,
					layout: store.layout,
					loading: store.loading,
					renderRegistry,
				})
			);
		}
		events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		const initializing = Promise.all(emitter.listeners('prepareInitialProject').map(listener => listener()));
		expect(fetch).toHaveBeenCalledWith('https://example.com/project.8f4e', { cache: 'no-store' });
		expect(storage.getItem).not.toHaveBeenCalled();
		expect(getProjectModules(JSON.parse(saved))).toEqual([]);
		expect(store.getState().loadingIndicators.find(indicator => indicator.id === 'project-url')?.status).toBe(
			'loading'
		);
		finish(new Response(source));
		await initializing;
		expect(store.getState().loadingIndicators.find(indicator => indicator.id === 'project-url')?.status).toBe('done');
		await vi.waitFor(() => expect(getProjectModules(JSON.parse(saved))[0]?.code).toContain('module remote'));
		// History is installed before the lazy plugin gate, so an early API edit is already undoable.
		const { handle: editing, dispose } = createEditorCommandApi(store, events);
		disposers.push(dispose);
		events.dispatch('enterEditMode');
		const remote = () => store.getState().project.activeLevel.blocks.find(block => block.name === 'remote')!;
		const originalCode = [...remote().code];
		const initialRevision = editing.getRevision();
		events.dispatch('undo');
		expect(editing.getRevision()).toBe(initialRevision);
		const edited = editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(remote()),
					code: [...originalCode.slice(0, -1), '; early API edit', originalCode.at(-1)!],
				},
			],
		});
		expect(edited.revision).not.toBe(initialRevision);
		events.dispatch('undo');
		expect(remote().code).toEqual(originalCode);
		expect(editing.getRevision()).not.toBe(edited.revision);
		expect(getProjectModules(JSON.parse(saved))[0].code).toEqual(originalCode);
		expect(store.getState().gridSizeReady).toBe(false);
		expect(store.getState().viewport).toMatchObject({ vGrid: 0, hGrid: 0 });
		expect(store.getState().project.activeLevel.blocks.find(block => block.name === 'remote')?.gaps.size).toBe(0);
		setGridSize(store.getState(), events, { vGrid: 8, hGrid: 16 });
		events.dispatch('ready');
		await vi.waitFor(() =>
			expect(
				store
					.getState()
					.project.activeLevel.blocks.find(block => block.name === 'remote')
					?.gaps.get(2)?.size
			).toBe(8)
		);
		expect(store.getState().project.activeLevel.blocks.some(block => block.name === 'oldSession')).toBe(false);
	} finally {
		while (disposers.length) disposers.pop()!();
		store.dispose();
		vi.unstubAllGlobals();
	}
});
