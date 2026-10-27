import initEditor, { type Editor } from '@8f4e/editor-core';
import { createScreenshotPlugin } from '@8f4e/editor-plugin-screenshot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDefaultEditor } from './index';

vi.mock('@8f4e/editor-core', () => ({ default: vi.fn() }));
vi.mock('@8f4e/editor-plugin-screenshot', () => ({
	createScreenshotPlugin: vi.fn(() => ({ id: 'screenshot', setup: () => () => {} })),
}));
vi.mock('./compiler-callback', () => ({ createCompilerService: () => ({ dispose: vi.fn() }) }));
vi.mock('./runtime-registry', () => ({ createRuntimeRegistry: () => ({}) }));
vi.mock('./storage-callbacks', () => ({
	createStorageCallbacks: () => ({}),
	createProjectFileCallbacks: () => ({ dispose: vi.fn() }),
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
			'screenshot',
		]);
		const options = vi.mocked(createScreenshotPlugin).mock.calls[0][0];
		expect(options.canvas).toBe(canvas);
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
		withoutPlugins.dispose();
	});
});
