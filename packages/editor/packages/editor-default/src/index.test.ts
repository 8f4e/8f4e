import exampleModuleSources from 'virtual:8f4e-sources/example-modules';
import initEditor, { type Editor } from '@8f4e/editor-core';
import { createElasticViewportPlugin } from '@8f4e/editor-plugin-elastic-viewport';
import { createExampleModulesPlugin } from '@8f4e/editor-plugin-example-modules';
import { createKeyboardMemoryPlugin } from '@8f4e/editor-plugin-keyboard-memory';
import { createDeferredPluginLoaderPlugin, createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createMouseInputPlugin } from '@8f4e/editor-plugin-mouse-input';
import { createProjectFilesPlugin } from '@8f4e/editor-plugin-project-files';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import { createScreenshotPlugin } from '@8f4e/editor-plugin-screenshot';
import { createSessionPersistencePlugin } from '@8f4e/editor-plugin-session-persistence';
import { createWasmExportPlugin } from '@8f4e/editor-plugin-wasm-export';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDefaultEditor } from './index';

const { getCodeBuffer, getMemory, writeMemory } = vi.hoisted(() => ({
	getCodeBuffer: vi.fn(() => new Uint8Array()),
	writeMemory: vi.fn(),
	getMemory: vi.fn<() => WebAssembly.Memory | null>(() => null),
}));

vi.mock('@8f4e/editor-core', () => ({ default: vi.fn() }));
vi.mock('glugglugglug', () => ({ Engine: class {} }));
vi.mock('@8f4e/editor-plugin-elastic-viewport', { spy: true });
vi.mock('@8f4e/editor-plugin-mouse-input', { spy: true });
vi.mock('@8f4e/editor-plugin-lazy-loader', { spy: true });
vi.mock('@8f4e/editor-plugin-session-persistence', () => ({
	createSessionPersistencePlugin: vi.fn(() => ({ id: 'session-persistence', setup: () => () => {} })),
}));
vi.mock('@8f4e/editor-plugin-project-url-loader', () => ({
	createProjectUrlLoaderPlugin: vi.fn(() => ({ id: 'project-url-loader', setup: () => () => {} })),
}));
vi.mock('@8f4e/editor-plugin-example-modules', () => ({
	createExampleModulesPlugin: vi.fn(() => ({ id: 'example-modules', setup: () => () => {} })),
}));
vi.mock('@8f4e/editor-plugin-keyboard-memory', () => ({
	createKeyboardMemoryPlugin: vi.fn(() => ({ id: 'keyboard-memory', setup: () => () => {} })),
}));
vi.mock('@8f4e/editor-plugin-screenshot', () => ({
	createScreenshotPlugin: vi.fn(() => ({ id: 'screenshot', setup: () => () => {} })),
}));
vi.mock('@8f4e/editor-plugin-project-files', () => ({
	createProjectFilesPlugin: vi.fn(() => ({ id: 'project-files', setup: () => () => {} })),
}));
vi.mock('@8f4e/editor-plugin-wasm-export', () => ({
	createWasmExportPlugin: vi.fn(() => ({ id: 'wasm-export', setup: () => () => {} })),
}));
vi.mock('@8f4e/editor-plugin-compiler', () => ({
	createCompilerPlugin: vi.fn(() => ({
		plugin: { id: 'compiler', setup: () => () => {} },
		getCodeBuffer,
		getMemory,
		writeMemory,
		getDiagnostics: vi.fn(() => null),
		getAssertionSites: vi.fn(() => undefined),
	})),
}));

async function loadDeferredPlugins() {
	const loader = await vi.mocked(createDeferredPluginLoaderPlugin).mock.calls.at(-1)![0].load();
	const entries = vi.mocked(createLazyPluginLoaderPlugin).mock.calls.at(-1)![0];
	const plugins = await Promise.all(entries.filter(entry => entry.matches([])).map(entry => entry.load()));
	return [loader, ...plugins];
}

describe('default editor plugins', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getMemory.mockReturnValue(null);
		getCodeBuffer.mockReturnValue(new Uint8Array());
		vi.stubGlobal('window', { navigator: {}, matchMedia: vi.fn(() => ({ matches: false })) });
	});
	afterEach(() => vi.unstubAllGlobals());

	it('composes the standard plugins and injects the mounted canvas and render callback', async () => {
		const renderFrame = vi.fn();
		vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn(), renderFrame } as Editor);
		const canvas = { ownerDocument: { defaultView: window } } as HTMLCanvasElement;
		const editor = await mountDefaultEditor(canvas, { storage: {} as Storage, captureWheel: false });
		expect(vi.mocked(initEditor).mock.calls.at(-1)![1].defaultFont).toBeUndefined();
		const initialPlugins = vi.mocked(initEditor).mock.calls.at(-1)![1].plugins!;
		expect(initialPlugins.map(plugin => plugin.id)).toEqual([
			'compiler',
			'undo-redo',
			'home',
			'project-url-loader',
			'session-persistence',
			'dotted-background',
			'code-block-background',
			'code-rendering',
			'loading-indicators',
			'deferred-loader',
		]);
		expect(createScreenshotPlugin).not.toHaveBeenCalled();
		expect(createLazyPluginLoaderPlugin).not.toHaveBeenCalled();
		const deferredPlugins = await loadDeferredPlugins();
		expect(
			vi.mocked(window.matchMedia).mock.calls.filter(([query]) => query === '(prefers-reduced-motion: reduce)')
		).toHaveLength(1);
		expect(createMouseInputPlugin).toHaveBeenCalledWith({ inputTarget: canvas, captureWheel: false });
		const pluginIds = [...initialPlugins, ...deferredPlugins].map(plugin => plugin.id);
		expect(pluginIds).toContain('mouse-input');
		expect(pluginIds).not.toContain('selection-animation');
		expect(pluginIds).not.toContain('touch-input');
		expect(pluginIds[0]).toBe('compiler');
		expect(pluginIds).toEqual(
			expect.arrayContaining([
				'keyboard-mode-switching',
				'enter-group-button',
				'group-path',
				'keyboard-navigation',
				'keyboard-editing',
				'font-preview',
				'code-block-background',
				'code-rendering',
				'connectors',
				'wires',
				'error-messages',
				'jump-to-error',
				'loading-indicators',
				'dialogs',
				'context-menu',
				'project-new',
				'block-authoring',
				'toggle-disabled',
				'log-block-info',
				'coordinate-grid',
				'entry-outlines',
				'offscreen-block-arrows',
				'elastic-viewport',
				'stack-connections',
				'stack-producers',
				'tooltips',
				'favorites',
				'project-files',
			])
		);
		expect(pluginIds).not.toContain('watch');
		expect(pluginIds).not.toContain('stack');
		expect(pluginIds).not.toContain('pwa-updates');
		expect(createProjectUrlLoaderPlugin).toHaveBeenCalledWith({
			fetch: globalThis.fetch,
			initialProjectUrl: undefined,
			failureMode: 'empty-project',
		});
		expect(createSessionPersistencePlugin).toHaveBeenCalledWith({
			storage: expect.anything(),
			storageKey: 'project_editor',
			restoreOnStartup: true,
		});
		expect(createExampleModulesPlugin).toHaveBeenCalledWith({ sources: exampleModuleSources });
		expect(createKeyboardMemoryPlugin).not.toHaveBeenCalled();
		const options = vi.mocked(createScreenshotPlugin).mock.calls[0][0];
		expect(options.canvas).toBe(canvas);
		expect(createProjectFilesPlugin).toHaveBeenCalledWith({
			inputTarget: canvas,
		});
		expect(createWasmExportPlugin).toHaveBeenCalledWith({ document: canvas.ownerDocument, getCodeBuffer });
		expect(renderFrame).not.toHaveBeenCalled();
		options.renderFrame();
		expect(renderFrame).toHaveBeenCalledOnce();
		editor.dispose();
	});

	it('defers elastic viewport motion and forwards the live reduced-motion preference', async () => {
		vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as Editor);
		const motionPreference = { matches: false };
		vi.mocked(window.matchMedia).mockImplementation(
			query => (query === '(prefers-reduced-motion: reduce)' ? motionPreference : { matches: false }) as MediaQueryList
		);
		const canvas = { ownerDocument: { defaultView: window } } as HTMLCanvasElement;
		await mountDefaultEditor(canvas, { storage: {} as Storage });
		expect(createElasticViewportPlugin).not.toHaveBeenCalled();
		const plugins = await loadDeferredPlugins();
		expect(plugins.map(plugin => plugin.id)).toContain('elastic-viewport');
		expect(createElasticViewportPlugin).toHaveBeenCalledOnce();
		const { prefersReducedMotion } = vi.mocked(createElasticViewportPlugin).mock.calls[0][0];
		expect(prefersReducedMotion()).toBe(false);
		motionPreference.matches = true;
		expect(prefersReducedMotion()).toBe(true);
	});

	it('defers the PWA update plugin when the host supplies a service worker', async () => {
		vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as Editor);
		const canvas = { ownerDocument: { defaultView: window } } as HTMLCanvasElement;
		await mountDefaultEditor(canvas, {
			storage: {} as Storage,
			pwaUpdates: { ready: new Promise<ServiceWorkerRegistration>(() => {}) },
		});
		expect(createLazyPluginLoaderPlugin).not.toHaveBeenCalled();
		const plugins = await loadDeferredPlugins();
		expect(plugins.map(plugin => plugin.id)).toContain('pwa-updates');
	});

	it('gives an explicit initial URL priority over session restoration', async () => {
		vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as Editor);
		const canvas = { ownerDocument: { defaultView: window } } as HTMLCanvasElement;
		const storage = {} as Storage;
		const initialProjectUrl = 'https://example.com/project.8f4e';
		const editor = await mountDefaultEditor(canvas, {
			storage,
			storageNamespace: 'custom',
			initialProjectUrl,
		});
		expect(createProjectUrlLoaderPlugin).toHaveBeenCalledWith({
			fetch: globalThis.fetch,
			initialProjectUrl,
			failureMode: 'empty-project',
		});
		expect(createSessionPersistencePlugin).toHaveBeenCalledWith({
			storage,
			storageKey: 'project_custom',
			restoreOnStartup: false,
		});
		editor.dispose();
	});

	it('waits for core initialization before resolving the mount without a URL', async () => {
		let finish!: (editor: Editor) => void;
		vi.mocked(initEditor).mockReturnValueOnce(
			new Promise(resolve => {
				finish = resolve;
			})
		);
		const mounted = vi.fn();
		const canvas = { ownerDocument: { defaultView: window } } as HTMLCanvasElement;
		const mounting = mountDefaultEditor(canvas, {
			storage: {} as Storage,
		}).then(editor => {
			mounted(editor);
			return editor;
		});
		await vi.waitFor(() => expect(initEditor).toHaveBeenCalledOnce());
		expect(mounted).not.toHaveBeenCalled();
		const coreEditor = { dispose: vi.fn() } as Editor;
		finish(coreEditor);
		const editor = await mounting;
		expect(editor).toBe(coreEditor);
		expect(mounted).toHaveBeenCalledExactlyOnceWith(editor);
		editor.dispose();
	});

	it('omits mode switching from the standard set while retaining navigation and editing', async () => {
		vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as Editor);
		await mountDefaultEditor({ ownerDocument: { defaultView: window } } as HTMLCanvasElement, {
			storage: {} as Storage,
			includeKeyboardModeSwitching: false,
		});
		const ids = (await loadDeferredPlugins()).map(plugin => plugin.id);
		expect(ids).not.toContain('keyboard-mode-switching');
		expect(ids).toEqual(expect.arrayContaining(['group-path', 'keyboard-navigation', 'keyboard-editing']));
	});

	it('keeps the compiler first when hosts replace or omit feature plugins, including the dotted background', async () => {
		vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as Editor);
		const plugins = [{ id: 'custom', setup: vi.fn(() => () => {}) }];
		const editor = await mountDefaultEditor({ ownerDocument: { defaultView: window } } as HTMLCanvasElement, {
			storage: {} as Storage,
			plugins,
		});
		expect(vi.mocked(initEditor).mock.calls.at(-1)?.[1].plugins).toEqual([
			expect.objectContaining({ id: 'compiler' }),
			...plugins,
		]);
		editor.dispose();
		const withoutPlugins = await mountDefaultEditor({ ownerDocument: { defaultView: window } } as HTMLCanvasElement, {
			storage: {} as Storage,
			plugins: [],
		});
		expect(vi.mocked(initEditor).mock.calls.at(-1)?.[1].plugins).toEqual([expect.objectContaining({ id: 'compiler' })]);
		expect(createSessionPersistencePlugin).not.toHaveBeenCalled();
		expect(createProjectUrlLoaderPlugin).not.toHaveBeenCalled();
		expect(createExampleModulesPlugin).not.toHaveBeenCalled();
		expect(createKeyboardMemoryPlugin).not.toHaveBeenCalled();
		expect(createScreenshotPlugin).not.toHaveBeenCalled();
		expect(createProjectFilesPlugin).not.toHaveBeenCalled();
		expect(createWasmExportPlugin).not.toHaveBeenCalled();
		withoutPlugins.dispose();
	});
});

it('omits all keyboard plugins and keyboard guidance on coarse-pointer browsers', async () => {
	vi.stubGlobal('window', {
		navigator: {},
		matchMedia: (query: string) => ({ matches: query === '(pointer: coarse)' }),
	});
	vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as Editor);
	try {
		await mountDefaultEditor({ ownerDocument: { defaultView: window } } as HTMLCanvasElement, {
			storage: {} as Storage,
		});
		expect(vi.mocked(initEditor).mock.calls.at(-1)![1].defaultFont).toBe('pixelcode6x12');
		const plugins = await loadDeferredPlugins();
		expect(plugins.map(plugin => plugin.id)).toEqual(
			expect.arrayContaining(['mouse-input', 'touch-input', 'group-path'])
		);
		for (const id of ['keyboard-mode-switching', 'keyboard-navigation', 'keyboard-editing', 'font-preview'])
			expect(plugins.some(plugin => plugin.id === id)).toBe(false);
	} finally {
		vi.unstubAllGlobals();
	}
});

it.each([false, true])('honors an explicit default font with coarse pointer %s', async coarse => {
	const browserWindow = { matchMedia: () => ({ matches: coarse }) };
	vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as unknown as Editor);
	await mountDefaultEditor({ ownerDocument: { defaultView: browserWindow } } as unknown as HTMLCanvasElement, {
		defaultFont: 'scientifica5x11',
		storage: {} as Storage,
	});
	expect(vi.mocked(initEditor).mock.calls.at(-1)![1].defaultFont).toBe('scientifica5x11');
});
