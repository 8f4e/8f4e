import initEditor, { type Editor } from '@8f4e/editor-core';
import { createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { afterEach, expect, it, vi } from 'vitest';
import { mountMinimalEditor } from './index';

vi.mock('@8f4e/editor-core', () => ({ default: vi.fn() }));
vi.mock('@8f4e/editor-plugin-compiler', { spy: true });
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
		featureFlags: { modeToggling: false },
		onInitialProjectLoaded,
	});
	await vi.waitFor(() => expect(initEditor).toHaveBeenCalledOnce());
	const compiler = vi.mocked(createCompilerPlugin).mock.results[0].value;
	const options = vi.mocked(initEditor).mock.calls[0][1];
	expect(options.captureWheel).toBe(false);
	expect(options.featureFlags).toEqual({ projectCreation: false, modeToggling: false });
	expect(options.plugins![0]).toBe(compiler.plugin);
	expect(options.plugins!.map(plugin => plugin.id)).toEqual(
		expect.arrayContaining([
			'code-rendering',
			'connectors',
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
	const options = vi.mocked(initEditor).mock.calls.at(-1)![1];
	for (const id of ['keyboard-mode-switching', 'keyboard-navigation', 'keyboard-editing'])
		expect(options.plugins!.some(plugin => plugin.id === id)).toBe(false);
});
