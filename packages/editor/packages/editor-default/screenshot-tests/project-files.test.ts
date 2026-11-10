import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPluginContext } from '@8f4e/editor-core';
import { createProjectFileSession } from '@8f4e/editor-file-session';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { contextMenuPlugin } from '@8f4e/editor-plugin-context-menu';
import { errorMessagesPlugin } from '@8f4e/editor-plugin-error-messages';
import { createMouseInputPlugin } from '@8f4e/editor-plugin-mouse-input';
import { createProjectOpenPlugin } from '@8f4e/editor-plugin-project-open';
import { createProjectSavePlugin } from '@8f4e/editor-plugin-project-save';
import { expect, test, vi } from 'vitest';

test('opens a saved project while regenerating environment source and reserving error rows', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 384;
	document.body.append(canvas);
	const source = `8f4e/v1
constants env
; @pos 120 60
${Array.from({ length: 20 }, (_, index) => `const SAVED_${index} ${index}`).join('\n')}
constantsEnd
note imported
; @pos 4 3
; @config audioRuntime.enabled true
Imported project
noteEnd`;
	const handle = { getFile: vi.fn().mockResolvedValue(new File([source], 'imported.8f4e')) };
	vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([handle]));
	let editor: Editor | undefined;
	let context!: EditorPluginContext;
	try {
		const fileSession = createProjectFileSession();
		editor = await initEditor(canvas, {
			plugins: [
				fileSession.plugin,
				codeRenderingPlugin,
				errorMessagesPlugin,
				createProjectOpenPlugin({ document, fileSession }),
				{
					id: 'test-context',
					setup: services => {
						context = services;
						return () => {};
					},
				},
			],
		});
		editor.pauseRendering();
		context.events.dispatch('importProject');
		await expect
			.poll(() => editor!.state.loadingIndicators.find(item => item.id === 'project-file')?.status)
			.toBe('done');
		expect(fileSession.handle).toBe(handle);
		const blocks = editor.state.codeBlockRendering.currentProject.blocks;
		const env = blocks.find(block => block.name === 'env')!;
		expect(env.code).not.toContain('const SAVED_0 0');
		expect(env.displayModel.lines.map(line => line.text)).toEqual(env.code);
		expect(blocks.find(block => block.name === 'imported')!.gaps.size).toBeGreaterThan(0);
		expect(() => editor!.renderFrame()).not.toThrow();
		await expect(canvas).toMatchScreenshot('project-import-with-diagnostic');
	} finally {
		editor?.dispose();
		canvas.remove();
		vi.unstubAllGlobals();
	}
});

test('opens a file, saves from the canvas shortcut, and exports from the contributed menu', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 384;
	canvas.style.width = '768px';
	canvas.style.height = '384px';
	document.body.appendChild(canvas);
	const source = `8f4e/v1
constants env
; @pos 120 60
constantsEnd
note patch
; @pos 4 3
Save the current patch to a project file.
noteEnd`;
	const writable = {
		write: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		abort: vi.fn().mockResolvedValue(undefined),
	};
	const handle = {
		getFile: vi.fn().mockResolvedValue(new File([source], 'patch.8f4e')),
		requestPermission: vi.fn().mockResolvedValue('granted'),
		createWritable: vi.fn().mockResolvedValue(writable),
	};
	const showSaveFilePicker = vi.fn().mockResolvedValue(handle);
	vi.stubGlobal('showSaveFilePicker', showSaveFilePicker);
	vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([handle]));
	let editor: Editor | undefined;
	try {
		const fileSession = createProjectFileSession();
		editor = await initEditor(canvas, {
			initialProject: parseProjectSource(source),
			plugins: [
				contextMenuPlugin,
				createMouseInputPlugin({ inputTarget: canvas }),
				fileSession.plugin,
				createProjectOpenPlugin({ document, fileSession }),
				createProjectSavePlugin({ inputTarget: canvas, fileSession }),
			],
		});
		editor.state.editorMode = 'edit';
		const state = editor.state;
		await vi.waitFor(() =>
			expect(state.codeBlockRendering.currentProject.blocks.some(block => block.code.includes('note patch'))).toBe(true)
		);
		editor.pauseRendering();
		const original = state.initialProjectState;
		canvas.dispatchEvent(new MouseEvent('contextmenu', { clientX: 16, clientY: 16, bubbles: true }));
		await vi.waitFor(() => expect(state.contextMenu.items.some(item => item.action === 'importProject')).toBe(true));
		const openIndex = state.contextMenu.items.findIndex(item => item.action === 'importProject');
		const openX = 24;
		const openY = 24 + openIndex * state.viewport.hGrid;
		canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: openX, clientY: openY, bubbles: true }));
		canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: openX, clientY: openY, bubbles: true }));
		await vi.waitFor(() => expect(state.initialProjectState).not.toBe(original));
		expect(state.editorMode).toBe('view');
		editor.state.editorMode = 'edit';
		canvas.focus();
		const saveKey = new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true });
		canvas.dispatchEvent(saveKey);
		expect(saveKey.defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(writable.close).toHaveBeenCalledOnce());
		expect(showSaveFilePicker).not.toHaveBeenCalled();
		expect(parseProjectSource(await writable.write.mock.calls[0][0].text()).notes[0].code).toContain(
			'Save the current patch to a project file.'
		);
		canvas.dispatchEvent(new MouseEvent('contextmenu', { clientX: 16, clientY: 16, bubbles: true }));
		await vi.waitFor(() => expect(state.contextMenu.items.some(item => item.action === 'exportProject')).toBe(true));
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('project-file-menu');
		const menu = state.contextMenu;
		const index = menu.items.findIndex(item => item.action === 'exportProject');
		const x = 24;
		const y = 24 + index * state.viewport.hGrid;
		canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
		canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));
		await vi.waitFor(() => expect(writable.close).toHaveBeenCalledTimes(2));
		expect(showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'project.8f4e' }));
		expect(state.contextMenu.open).toBe(false);
		editor.dispose();
		const afterDispose = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
		canvas.dispatchEvent(afterDispose);
		expect(afterDispose.defaultPrevented).toBe(false);
		expect(writable.write).toHaveBeenCalledTimes(2);
	} finally {
		editor?.dispose();
		canvas.remove();
		vi.unstubAllGlobals();
	}
});
