import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor } from '@8f4e/editor-core';
import { expect, test, vi } from 'vitest';
import { createProjectFilesPlugin } from '../src/index';

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
		editor = await initEditor(canvas, {
			initialEditorMode: 'edit',
			initialProject: parseProjectSource(source),
			plugins: [createProjectFilesPlugin({ inputTarget: canvas })],
		});
		const state = editor.state;
		await vi.waitFor(() =>
			expect(state.codeBlockRendering.codeBlocks.some(block => block.code.includes('note patch'))).toBe(true)
		);
		editor.pauseRendering();
		const original = state.initialProjectState;
		canvas.dispatchEvent(new MouseEvent('contextmenu', { clientX: 600, clientY: 16, bubbles: true }));
		await vi.waitFor(() => expect(state.contextMenu.items.some(item => item.action === 'importProject')).toBe(true));
		const openIndex = state.contextMenu.items.findIndex(item => item.action === 'importProject');
		const openX = state.contextMenu.x - state.viewport.x + 8;
		const openY = state.contextMenu.y - state.viewport.y + openIndex * state.viewport.hGrid + 8;
		canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: openX, clientY: openY, bubbles: true }));
		canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: openX, clientY: openY, bubbles: true }));
		await vi.waitFor(() => expect(state.initialProjectState).not.toBe(original));
		canvas.focus();
		const saveKey = new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true });
		canvas.dispatchEvent(saveKey);
		expect(saveKey.defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(writable.close).toHaveBeenCalledOnce());
		expect(showSaveFilePicker).not.toHaveBeenCalled();
		expect(parseProjectSource(await writable.write.mock.calls[0][0].text()).notes[0].code).toContain(
			'Save the current patch to a project file.'
		);
		canvas.dispatchEvent(new MouseEvent('contextmenu', { clientX: 600, clientY: 16, bubbles: true }));
		await vi.waitFor(() => expect(state.contextMenu.items.some(item => item.action === 'exportProject')).toBe(true));
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('project-files-menu');
		const menu = state.contextMenu;
		const index = menu.items.findIndex(item => item.action === 'exportProject');
		const x = menu.x - state.viewport.x + 8;
		const y = menu.y - state.viewport.y + index * state.viewport.hGrid + 8;
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
