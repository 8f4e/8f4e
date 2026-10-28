import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/compiler';
import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { expect, it, vi } from 'vitest';
import { createDefaultEditorPlugins } from './index';

it('prioritizes the initial URL over the saved session and keeps autosaving while fetching', async () => {
	const source = '8f4e/v1\nentry main\nmodule remote\nmoduleEnd\nentryEnd';
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
	const store = initState(events, { callbacks: {}, runtimeRegistry: {}, initialEditorMode: 'edit' });
	const drawers = createCodeBlockDrawerRegistry();
	const disposers: Array<() => void> = [];
	try {
		const plugins = createDefaultEditorPlugins({
			canvas,
			storage: storage as Storage,
			storageKey: 'session',
			initialProjectUrl: 'https://example.com/project.8f4e',
			showOpenMenuItem: false,
			renderFrame: () => {},
			getMemory: () => null,
			getCodeBuffer: () => new Uint8Array(),
		});
		for (const plugin of plugins) {
			disposers.push(plugin.setup({ store, events, menus: store.menus, directives: store.directives, drawers }));
		}
		events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		events.dispatch('init');
		expect(fetch).toHaveBeenCalledWith('https://example.com/project.8f4e', { cache: 'no-store' });
		expect(storage.getItem).not.toHaveBeenCalled();
		expect(JSON.parse(saved).modules).toEqual([]);
		finish(new Response(source));
		await vi.waitFor(() => expect(JSON.parse(saved).modules[0]?.code).toContain('module remote'));
		expect(store.getState().codeBlockRendering.codeBlocks.some(block => block.name === 'oldSession')).toBe(false);
	} finally {
		while (disposers.length) disposers.pop()!();
		store.dispose();
		vi.unstubAllGlobals();
	}
});
