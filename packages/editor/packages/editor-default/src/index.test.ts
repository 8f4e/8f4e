import exampleModuleSources from 'virtual:8f4e-sources/example-modules';
import initEditor, { type Editor } from '@8f4e/editor-core';
import { createBinaryAssetsPlugin } from '@8f4e/editor-plugin-binary-assets';
import { createExampleModulesPlugin } from '@8f4e/editor-plugin-example-modules';
import { createKeyboardMemoryPlugin } from '@8f4e/editor-plugin-keyboard-memory';
import { createMidiInputPlugin } from '@8f4e/editor-plugin-midi-input';
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
vi.mock('@8f4e/editor-plugin-midi-input', () => ({
	createMidiInputPlugin: vi.fn(() => ({ id: 'midi-input', setup: () => () => {} })),
}));
vi.mock('@8f4e/editor-plugin-binary-assets', () => ({
	createBinaryAssetsPlugin: vi.fn(() => ({ id: 'binary-assets', setup: () => () => {} })),
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
		const editor = await mountDefaultEditor(canvas, { storage: {} as Storage });
		const pluginIds = vi
			.mocked(initEditor)
			.mock.calls.at(-1)![1]
			.plugins!.map(plugin => plugin.id);
		expect(pluginIds[0]).toBe('compiler');
		expect(pluginIds).toEqual(expect.arrayContaining(['watch', 'stack', 'tooltips']));
		expect(pluginIds.indexOf('watch')).toBeLessThan(pluginIds.indexOf('tooltips'));
		expect(pluginIds.indexOf('stack')).toBeLessThan(pluginIds.indexOf('tooltips'));
		const getBytes = vi.mocked(createBinaryAssetsPlugin).mock.calls[0][0].getMemoryBytes;
		expect(createProjectUrlLoaderPlugin).toHaveBeenCalledWith({
			fetch: globalThis.fetch,
			initialProjectUrl: undefined,
			onLoaded: undefined,
			onError: undefined,
		});
		expect(createSessionPersistencePlugin).toHaveBeenCalledWith({
			storage: expect.anything(),
			storageKey: 'project_editor',
			restoreOnStartup: true,
		});
		expect(createExampleModulesPlugin).toHaveBeenCalledWith({ sources: exampleModuleSources });
		expect(createKeyboardMemoryPlugin).toHaveBeenCalledWith({ inputTarget: canvas, writeMemory });
		expect(createMidiInputPlugin).toHaveBeenCalledWith({ navigator: window.navigator, getMemory, getCodeBuffer });
		expect(getBytes()).toBeUndefined();
		const memory = new WebAssembly.Memory({ initial: 1 });
		getMemory.mockReturnValue(memory);
		expect(getBytes()?.buffer).toBe(memory.buffer);
		memory.grow(1);
		expect(getBytes()?.byteLength).toBe(memory.buffer.byteLength);
		const options = vi.mocked(createScreenshotPlugin).mock.calls[0][0];
		expect(options.canvas).toBe(canvas);
		expect(createProjectFilesPlugin).toHaveBeenCalledWith({ inputTarget: canvas, showOpenMenuItem: true });
		expect(createWasmExportPlugin).toHaveBeenCalledWith({ document: canvas.ownerDocument, getCodeBuffer });
		expect(renderFrame).not.toHaveBeenCalled();
		options.renderFrame();
		expect(renderFrame).toHaveBeenCalledOnce();
		editor.dispose();
	});

	it('gives an explicit initial URL priority over session restoration', async () => {
		vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as Editor);
		const canvas = { ownerDocument: { defaultView: window } } as HTMLCanvasElement;
		const storage = {} as Storage;
		const initialProjectUrl = 'https://example.com/project.8f4e';
		const onInitialProjectLoaded = vi.fn();
		const onInitialProjectLoadError = vi.fn();
		const editor = await mountDefaultEditor(canvas, {
			storage,
			storageNamespace: 'custom',
			initialProjectUrl,
			onInitialProjectLoaded,
			onInitialProjectLoadError,
			showOpenMenuItem: false,
		});
		expect(createProjectUrlLoaderPlugin).toHaveBeenCalledWith({
			fetch: globalThis.fetch,
			initialProjectUrl,
			onLoaded: onInitialProjectLoaded,
			onError: onInitialProjectLoadError,
		});
		expect(onInitialProjectLoaded).not.toHaveBeenCalled();
		expect(onInitialProjectLoadError).not.toHaveBeenCalled();
		expect(createProjectFilesPlugin).toHaveBeenCalledWith({ inputTarget: canvas, showOpenMenuItem: false });
		expect(createSessionPersistencePlugin).toHaveBeenCalledWith({
			storage,
			storageKey: 'project_custom',
			restoreOnStartup: false,
		});
		editor.dispose();
	});

	it('reports initialized content without a URL once editor initialization finishes', async () => {
		let finish!: (editor: Editor) => void;
		vi.mocked(initEditor).mockReturnValueOnce(
			new Promise(resolve => {
				finish = resolve;
			})
		);
		const onInitialProjectLoaded = vi.fn();
		const onInitialProjectLoadError = vi.fn();
		const canvas = { ownerDocument: { defaultView: window } } as HTMLCanvasElement;
		const mounting = mountDefaultEditor(canvas, {
			storage: {} as Storage,
			onInitialProjectLoaded,
			onInitialProjectLoadError,
		});
		expect(onInitialProjectLoaded).not.toHaveBeenCalled();
		finish({ dispose: vi.fn() } as Editor);
		const editor = await mounting;
		expect(onInitialProjectLoaded).toHaveBeenCalledOnce();
		expect(onInitialProjectLoadError).not.toHaveBeenCalled();
		editor.dispose();
	});

	it('keeps the compiler first when hosts replace or omit feature plugins', async () => {
		vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as Editor);
		const plugins = [{ id: 'custom', setup: vi.fn(() => () => {}) }];
		const editor = await mountDefaultEditor({} as HTMLCanvasElement, { storage: {} as Storage, plugins });
		expect(vi.mocked(initEditor).mock.calls.at(-1)?.[1].plugins).toEqual([
			expect.objectContaining({ id: 'compiler' }),
			...plugins,
		]);
		editor.dispose();
		const withoutPlugins = await mountDefaultEditor({} as HTMLCanvasElement, { storage: {} as Storage, plugins: [] });
		expect(vi.mocked(initEditor).mock.calls.at(-1)?.[1].plugins).toEqual([expect.objectContaining({ id: 'compiler' })]);
		expect(createSessionPersistencePlugin).not.toHaveBeenCalled();
		expect(createProjectUrlLoaderPlugin).not.toHaveBeenCalled();
		expect(createExampleModulesPlugin).not.toHaveBeenCalled();
		expect(createBinaryAssetsPlugin).not.toHaveBeenCalled();
		expect(createKeyboardMemoryPlugin).not.toHaveBeenCalled();
		expect(createMidiInputPlugin).not.toHaveBeenCalled();
		expect(createScreenshotPlugin).not.toHaveBeenCalled();
		expect(createProjectFilesPlugin).not.toHaveBeenCalled();
		expect(createWasmExportPlugin).not.toHaveBeenCalled();
		withoutPlugins.dispose();
	});
});
