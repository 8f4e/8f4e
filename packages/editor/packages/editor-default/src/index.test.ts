import initEditor, { type Editor } from '@8f4e/editor-core';
import { createProjectExportPlugin } from '@8f4e/editor-plugin-project-export';
import { createScreenshotPlugin } from '@8f4e/editor-plugin-screenshot';
import { createWasmExportPlugin } from '@8f4e/editor-plugin-wasm-export';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDefaultEditor } from './index';
import { exportBinaryCode } from './storage-callbacks';

const { projectFiles, getCodeBuffer } = vi.hoisted(() => ({
	projectFiles: {
		dispose: vi.fn(),
		importProject: vi.fn(),
		projectLoaded: vi.fn(),
		saveProject: vi.fn(),
		exportProject: vi.fn(),
	},
	getCodeBuffer: vi.fn(() => new Uint8Array()),
}));

vi.mock('@8f4e/editor-core', () => ({ default: vi.fn() }));
vi.mock('@8f4e/editor-plugin-screenshot', () => ({
	createScreenshotPlugin: vi.fn(() => ({ id: 'screenshot', setup: () => () => {} })),
}));
vi.mock('@8f4e/editor-plugin-project-export', () => ({
	createProjectExportPlugin: vi.fn(() => ({ id: 'project-export', setup: () => () => {} })),
}));
vi.mock('@8f4e/editor-plugin-wasm-export', () => ({
	createWasmExportPlugin: vi.fn(() => ({ id: 'wasm-export', setup: () => () => {} })),
}));
vi.mock('./compiler-callback', () => ({ createCompilerService: () => ({ dispose: vi.fn(), getCodeBuffer }) }));
vi.mock('./runtime-registry', () => ({ createRuntimeRegistry: () => ({}) }));
vi.mock('./storage-callbacks', () => ({
	createStorageCallbacks: () => ({}),
	createProjectFileCallbacks: () => projectFiles,
	exportBinaryCode: vi.fn(),
}));

describe('default editor plugins', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('window', { matchMedia: vi.fn(() => ({ matches: false })) });
	});
	afterEach(() => vi.unstubAllGlobals());

	it('composes the standard plugins and injects the mounted canvas and render callback', async () => {
		const renderFrame = vi.fn();
		vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn(), renderFrame } as Editor);
		const canvas = {} as HTMLCanvasElement;
		const editor = await mountDefaultEditor(canvas, { storage: {} as Storage });
		expect(
			vi
				.mocked(initEditor)
				.mock.calls.at(-1)?.[1]
				.plugins?.map(plugin => plugin.id)
		).toEqual([
			'toggle-skip-execution',
			'switch',
			'button',
			'wave',
			'piano',
			'slider',
			'meter',
			'plot',
			'bars',
			'crossfade',
			'watch',
			'stack',
			'tooltips',
			'project-export',
			'wasm-export',
			'screenshot',
		]);
		const options = vi.mocked(createScreenshotPlugin).mock.calls[0][0];
		expect(options.canvas).toBe(canvas);
		expect(createProjectExportPlugin).toHaveBeenCalledWith({
			inputTarget: canvas,
			saveProject: projectFiles.saveProject,
			exportProject: projectFiles.exportProject,
		});
		const coreCallbacks = vi.mocked(initEditor).mock.calls.at(-1)![1].callbacks;
		expect(coreCallbacks.importProject).toBe(projectFiles.importProject);
		expect(coreCallbacks.projectLoaded).toBe(projectFiles.projectLoaded);
		for (const name of ['saveProject', 'exportProject', 'exportBinaryCode'])
			expect(coreCallbacks).not.toHaveProperty(name);
		const bytes = new Uint8Array([0, 97, 115, 109]);
		getCodeBuffer.mockReturnValue(bytes);
		await vi.mocked(createWasmExportPlugin).mock.calls[0][0].exportBinaryCode('current.wasm');
		expect(exportBinaryCode).toHaveBeenCalledWith('current.wasm', bytes);
		expect(renderFrame).not.toHaveBeenCalled();
		options.renderFrame();
		expect(renderFrame).toHaveBeenCalledOnce();
		editor.dispose();
	});

	it('lets hosts replace the plugin set or omit plugins', async () => {
		vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as Editor);
		const plugins = [{ id: 'custom', setup: vi.fn(() => () => {}) }];
		const editor = await mountDefaultEditor({} as HTMLCanvasElement, { storage: {} as Storage, plugins });
		expect(vi.mocked(initEditor).mock.calls.at(-1)?.[1].plugins).toBe(plugins);
		editor.dispose();
		const withoutPlugins = await mountDefaultEditor({} as HTMLCanvasElement, { storage: {} as Storage, plugins: [] });
		expect(vi.mocked(initEditor).mock.calls.at(-1)?.[1].plugins).toEqual([]);
		expect(createScreenshotPlugin).not.toHaveBeenCalled();
		expect(createProjectExportPlugin).not.toHaveBeenCalled();
		expect(createWasmExportPlugin).not.toHaveBeenCalled();
		withoutPlugins.dispose();
	});
});
