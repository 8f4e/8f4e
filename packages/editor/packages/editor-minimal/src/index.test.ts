import initEditor, { type Editor } from '@8f4e/editor-core';
import { createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createDeferredPluginLoaderPlugin, createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createMouseInputPlugin } from '@8f4e/editor-plugin-mouse-input';
import { afterEach, expect, it, vi } from 'vitest';
import { mountMinimalEditor } from './index';

vi.mock('@8f4e/editor-core', () => ({ default: vi.fn() }));
vi.mock('@8f4e/editor-plugin-mouse-input', { spy: true });
vi.mock('@8f4e/editor-plugin-compiler', { spy: true });
vi.mock('@8f4e/editor-plugin-lazy-loader', { spy: true });

async function loadDeferredPlugins() {
	const loader = await vi.mocked(createDeferredPluginLoaderPlugin).mock.calls.at(-1)![0].load();
	const entries = vi.mocked(createLazyPluginLoaderPlugin).mock.calls.at(-1)![0];
	const plugins = await Promise.all(entries.filter(entry => entry.matches([])).map(entry => entry.load()));
	return [loader, ...plugins];
}
afterEach(() => vi.clearAllMocks());

it('starts without storage and reports empty-project readiness after initialization', async () => {
	let finish!: (editor: Editor) => void;
	vi.mocked(initEditor).mockReturnValueOnce(
		new Promise(resolve => {
			finish = resolve;
		})
	);
	const browserWindow = { navigator: {}, matchMedia: () => ({ matches: false }) };
	const canvas = { ownerDocument: { defaultView: browserWindow } } as HTMLCanvasElement;
	const onInitialProjectLoaded = vi.fn();
	const mounting = mountMinimalEditor(canvas, {
		captureWheel: false,
		featureFlags: { moduleDragging: false },
		onInitialProjectLoaded,
	});
	await vi.waitFor(() => expect(initEditor).toHaveBeenCalledOnce());
	const compiler = vi.mocked(createCompilerPlugin).mock.results[0].value;
	const options = vi.mocked(initEditor).mock.calls[0][1];
	expect(options.featureFlags).toEqual({ projectCreation: false, moduleDragging: false });
	expect(options.plugins![0]).toBe(compiler.plugin);
	expect(options.plugins!.map(plugin => plugin.id)).not.toContain('watch');
	expect(options.plugins!.map(plugin => plugin.id)).not.toContain('stack');
	expect(options.plugins!.map(plugin => plugin.id)).toEqual([
		'compiler',
		'project-file-session',
		'code-rendering',
		'project-url-loader',
		'deferred-loader',
	]);
	expect(createLazyPluginLoaderPlugin).not.toHaveBeenCalled();
	const deferredPlugins = await loadDeferredPlugins();
	expect(createMouseInputPlugin).toHaveBeenCalledWith({ inputTarget: canvas, captureWheel: false });
	expect(deferredPlugins.map(plugin => plugin.id)).toContain('mouse-input');
	expect(deferredPlugins.map(plugin => plugin.id)).not.toContain('selection-animation');
	expect(deferredPlugins.map(plugin => plugin.id)).not.toContain('touch-input');
	expect([...(options.plugins ?? []), ...deferredPlugins].map(plugin => plugin.id)).toEqual(
		expect.arrayContaining([
			'code-rendering',
			'connectors',
			'dialogs',
			'keyboard-navigation',
			'keyboard-mode-switching',
			'keyboard-editing',
		])
	);
	expect(onInitialProjectLoaded).not.toHaveBeenCalled();
	const coreEditor = { dispose: vi.fn() } as unknown as Editor;
	finish(coreEditor);
	const editor = await mounting;
	expect(editor).toBe(coreEditor);
	expect(editor.getCompilerDiagnostics).toBe(compiler.getDiagnostics);
	expect(onInitialProjectLoaded).toHaveBeenCalledOnce();
	editor.dispose();
});

it('omits all keyboard plugins on coarse-pointer browsers', async () => {
	const browserWindow = { navigator: {}, matchMedia: (query: string) => ({ matches: query === '(pointer: coarse)' }) };
	vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as unknown as Editor);
	await mountMinimalEditor({ ownerDocument: { defaultView: browserWindow } } as HTMLCanvasElement);
	const plugins = await loadDeferredPlugins();
	expect(plugins.map(plugin => plugin.id)).toEqual(expect.arrayContaining(['mouse-input', 'touch-input']));
	for (const id of ['keyboard-mode-switching', 'keyboard-navigation', 'keyboard-editing'])
		expect(plugins.some(plugin => plugin.id === id)).toBe(false);
});

it('omits mode switching while retaining navigation and editing', async () => {
	const browserWindow = { navigator: {}, matchMedia: () => ({ matches: false }) };
	vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as unknown as Editor);
	await mountMinimalEditor({ ownerDocument: { defaultView: browserWindow } } as HTMLCanvasElement, {
		includeKeyboardModeSwitching: false,
	});
	const ids = (await loadDeferredPlugins()).map(plugin => plugin.id);
	expect(ids).not.toContain('keyboard-mode-switching');
	expect(ids).toEqual(expect.arrayContaining(['keyboard-navigation', 'keyboard-editing']));
});
