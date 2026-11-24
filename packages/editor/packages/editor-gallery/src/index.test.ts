import initEditor, { type Editor } from '@8f4e/editor-core';
import { createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createElasticViewportPlugin } from '@8f4e/editor-plugin-elastic-viewport';
import { createFontPreviewPlugin } from '@8f4e/editor-plugin-font-preview';
import { createGroupPathPlugin } from '@8f4e/editor-plugin-group-path';
import { createDeferredPluginLoaderPlugin, createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createMouseInputPlugin } from '@8f4e/editor-plugin-mouse-input';
import { afterEach, expect, it, vi } from 'vitest';
import { mountGalleryEditor } from './index';

vi.mock('@8f4e/editor-core', () => ({ default: vi.fn() }));
vi.mock('glugglugglug', () => ({ Engine: class {} }));
vi.mock('@8f4e/editor-plugin-mouse-input', { spy: true });
vi.mock('@8f4e/editor-plugin-compiler', { spy: true });
vi.mock('@8f4e/editor-plugin-elastic-viewport', { spy: true });
vi.mock('@8f4e/editor-plugin-font-preview', { spy: true });
vi.mock('@8f4e/editor-plugin-group-path', { spy: true });
vi.mock('@8f4e/editor-plugin-lazy-loader', { spy: true });

async function loadDeferredPlugins() {
	const loader = await vi.mocked(createDeferredPluginLoaderPlugin).mock.calls.at(-1)![0].load();
	const entries = vi.mocked(createLazyPluginLoaderPlugin).mock.calls.at(-1)![0];
	const plugins = await Promise.all(entries.filter(entry => entry.matches([])).map(entry => entry.load()));
	return [loader, ...plugins];
}
afterEach(() => vi.clearAllMocks());

it('starts without storage and waits for core initialization before resolving the mount', async () => {
	let finish!: (editor: Editor) => void;
	vi.mocked(initEditor).mockReturnValueOnce(
		new Promise(resolve => {
			finish = resolve;
		})
	);
	const reducedMotion = { matches: false };
	const browserWindow = {
		navigator: {},
		matchMedia: vi.fn((query: string) =>
			query === '(prefers-reduced-motion: reduce)' ? reducedMotion : { matches: false }
		),
	};
	const canvas = { ownerDocument: { defaultView: browserWindow } } as HTMLCanvasElement;
	const mounted = vi.fn();
	const mounting = mountGalleryEditor(canvas, {
		captureWheel: false,
		featureFlags: { canvasOverlays: false },
	}).then(editor => {
		mounted(editor);
		return editor;
	});
	await vi.waitFor(() => expect(initEditor).toHaveBeenCalledOnce());
	const compiler = vi.mocked(createCompilerPlugin).mock.results[0].value;
	const options = vi.mocked(initEditor).mock.calls[0][1];
	expect(options.defaultFont).toBeUndefined();
	expect(options.featureFlags).toEqual({ canvasOverlays: false });
	expect(options.plugins![0]).toBe(compiler.plugin);
	expect(options.plugins!.map(plugin => plugin.id)).not.toContain('watch');
	expect(options.plugins!.map(plugin => plugin.id)).not.toContain('stack');
	expect(options.plugins!.map(plugin => plugin.id)).toEqual([
		'compiler',
		'project-file-session',
		'home',
		'dotted-background',
		'code-block-background',
		'code-rendering',
		'loading-indicators',
		'project-url-loader',
		'deferred-loader',
	]);
	expect(createLazyPluginLoaderPlugin).not.toHaveBeenCalled();
	expect(createElasticViewportPlugin).not.toHaveBeenCalled();
	const deferredPlugins = await loadDeferredPlugins();
	expect(browserWindow.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
	expect(
		browserWindow.matchMedia.mock.calls.filter(([query]) => query === '(prefers-reduced-motion: reduce)')
	).toHaveLength(1);
	expect(createElasticViewportPlugin).toHaveBeenCalledOnce();
	const motionOptions = vi.mocked(createElasticViewportPlugin).mock.calls[0][0];
	expect(motionOptions.prefersReducedMotion()).toBe(false);
	reducedMotion.matches = true;
	expect(motionOptions.prefersReducedMotion()).toBe(true);
	expect(createMouseInputPlugin).toHaveBeenCalledWith({ inputTarget: canvas, captureWheel: false });
	expect(createFontPreviewPlugin).toHaveBeenCalledWith({ inputTarget: canvas, defaultFont: undefined });
	expect(createGroupPathPlugin).toHaveBeenCalledWith({ topRow: 1 });
	expect(deferredPlugins.map(plugin => plugin.id)).toContain('mouse-input');
	expect(deferredPlugins.map(plugin => plugin.id)).not.toContain('selection-animation');
	expect(deferredPlugins.map(plugin => plugin.id)).not.toContain('touch-input');
	expect(deferredPlugins.map(plugin => plugin.id)).not.toContain('keyboard-memory');
	expect([...(options.plugins ?? []), ...deferredPlugins].map(plugin => plugin.id)).not.toContain('project-new');
	expect([...(options.plugins ?? []), ...deferredPlugins].map(plugin => plugin.id)).toEqual(
		expect.arrayContaining([
			'code-block-background',
			'code-rendering',
			'connectors',
			'loose-wires',
			'error-messages',
			'jump-to-error',
			'loading-indicators',
			'dialogs',
			'context-menu',
			'block-authoring',
			'coordinate-grid',
			'entry-outlines',
			'elastic-viewport',
			'offscreen-block-arrows',
			'stack-connections',
			'keyboard-navigation',
			'keyboard-mode-switching',
			'enter-group-button',
			'group-path',
			'keyboard-editing',
			'font-preview',
		])
	);
	expect(mounted).not.toHaveBeenCalled();
	const coreEditor = { dispose: vi.fn() } as unknown as Editor;
	finish(coreEditor);
	const editor = await mounting;
	expect(editor).toBe(coreEditor);
	expect(editor.getCompilerDiagnostics).toBe(compiler.getDiagnostics);
	expect(mounted).toHaveBeenCalledExactlyOnceWith(editor);
	editor.dispose();
});

it('defaults to Departure Mono and omits keyboard plugins on coarse-pointer browsers', async () => {
	const browserWindow = { navigator: {}, matchMedia: (query: string) => ({ matches: query === '(pointer: coarse)' }) };
	vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as unknown as Editor);
	await mountGalleryEditor({ ownerDocument: { defaultView: browserWindow } } as HTMLCanvasElement);
	expect(vi.mocked(initEditor).mock.calls.at(-1)![1].defaultFont).toBe('departuremono7x14');
	const plugins = await loadDeferredPlugins();
	expect(plugins.map(plugin => plugin.id)).toEqual(
		expect.arrayContaining([
			'mouse-input',
			'touch-input',
			'enter-group-button',
			'group-path',
			'elastic-viewport',
			'coordinate-grid',
		])
	);
	expect(createGroupPathPlugin).toHaveBeenCalledWith({ topRow: 0 });
	for (const id of ['keyboard-mode-switching', 'keyboard-navigation', 'keyboard-editing', 'font-preview'])
		expect(plugins.some(plugin => plugin.id === id)).toBe(false);
	expect(createFontPreviewPlugin).not.toHaveBeenCalled();
});

it('omits mode switching while retaining navigation and editing', async () => {
	const browserWindow = { navigator: {}, matchMedia: () => ({ matches: false }) };
	vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as unknown as Editor);
	await mountGalleryEditor({ ownerDocument: { defaultView: browserWindow } } as HTMLCanvasElement, {
		includeKeyboardModeSwitching: false,
	});
	const ids = (await loadDeferredPlugins()).map(plugin => plugin.id);
	expect(ids).not.toContain('keyboard-mode-switching');
	expect(ids).toEqual(expect.arrayContaining(['keyboard-navigation', 'keyboard-editing', 'font-preview']));
	expect(createGroupPathPlugin).toHaveBeenCalledWith({ topRow: 0 });
});

it.each([false, true])('honors an explicit default font with coarse pointer %s', async coarse => {
	const browserWindow = { navigator: {}, matchMedia: () => ({ matches: coarse }) };
	vi.mocked(initEditor).mockResolvedValue({ dispose: vi.fn() } as unknown as Editor);
	await mountGalleryEditor({ ownerDocument: { defaultView: browserWindow } } as unknown as HTMLCanvasElement, {
		defaultFont: 'scientifica5x11',
	});
	expect(vi.mocked(initEditor).mock.calls.at(-1)![1].defaultFont).toBe('scientifica5x11');
	await loadDeferredPlugins();
	if (coarse) expect(createFontPreviewPlugin).not.toHaveBeenCalled();
	else {
		expect(createFontPreviewPlugin).toHaveBeenCalledWith({
			inputTarget: expect.anything(),
			defaultFont: 'scientifica5x11',
		});
	}
});
