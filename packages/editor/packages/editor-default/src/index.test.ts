import initEditor, { type Editor } from '@8f4e/editor-core';
import { describe, expect, it, vi } from 'vitest';
import { defaultEditorPlugins, mountDefaultEditor } from './index';

vi.mock('@8f4e/editor-core', () => ({ default: vi.fn() }));
vi.mock('./compiler-callback', () => ({ createCompilerService: () => ({ dispose: vi.fn() }) }));
vi.mock('./runtime-registry', () => ({ createRuntimeRegistry: () => ({}) }));
vi.mock('./storage-callbacks', () => ({
	createStorageCallbacks: () => ({}),
	createProjectFileCallbacks: () => ({ dispose: vi.fn() }),
	exportBinaryCode: vi.fn(),
	exportCanvasScreenshot: vi.fn(),
}));

describe('default editor plugins', () => {
	it('includes the execution toggle and switch widget in the default composition', async () => {
		vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as unknown as Editor);
		const editor = await mountDefaultEditor({} as HTMLCanvasElement, { storage: {} as Storage });
		expect(vi.mocked(initEditor).mock.calls.at(-1)?.[1].plugins).toBe(defaultEditorPlugins);
		expect(defaultEditorPlugins.map(plugin => plugin.id)).toEqual(['toggle-skip-execution', 'switch']);
		editor.dispose();
	});

	it('lets hosts replace the plugin set or omit plugins', async () => {
		vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as unknown as Editor);
		const plugins = [{ id: 'custom', setup: vi.fn(() => () => {}) }];
		const editor = await mountDefaultEditor({} as HTMLCanvasElement, { storage: {} as Storage, plugins });
		expect(vi.mocked(initEditor).mock.calls.at(-1)?.[1].plugins).toBe(plugins);
		editor.dispose();
		const withoutPlugins = await mountDefaultEditor({} as HTMLCanvasElement, { storage: {} as Storage, plugins: [] });
		expect(vi.mocked(initEditor).mock.calls.at(-1)?.[1].plugins).toEqual([]);
		withoutPlugins.dispose();
	});
});
