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
	const compiler = vi.mocked(createCompilerPlugin).mock.results[0].value;
	const options = vi.mocked(initEditor).mock.calls[0][1];
	expect(options.captureWheel).toBe(false);
	expect(options.featureFlags).toEqual({ projectCreation: false, modeToggling: false });
	expect(options.plugins![0]).toBe(compiler.plugin);
	expect(options.plugins!.map(plugin => plugin.id)).toContain('connectors');
	expect(onInitialProjectLoaded).not.toHaveBeenCalled();
	const coreEditor = { dispose: vi.fn() } as unknown as Editor;
	finish(coreEditor);
	const editor = await mounting;
	expect(editor).toBe(coreEditor);
	expect(editor.getCompilerDiagnostics).toBe(compiler.getDiagnostics);
	expect(onInitialProjectLoaded).toHaveBeenCalledOnce();
	editor.dispose();
});
