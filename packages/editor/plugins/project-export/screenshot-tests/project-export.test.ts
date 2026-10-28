import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor } from '@8f4e/editor-core';
import { expect, test, vi } from 'vitest';
import { createProjectExportPlugin } from '../src/index';

test('saves from the canvas shortcut and exports from the contributed menu', async () => {
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
	const saveProject = vi.fn<(text: string, fileName: string) => Promise<void>>().mockResolvedValue(undefined);
	const exportProject = vi.fn<(text: string, fileName: string) => Promise<void>>().mockResolvedValue(undefined);
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
			initialEditorMode: 'edit',
			runtimeRegistry: {},
			initialProject: parseProjectSource(source),
			callbacks: {},
			plugins: [createProjectExportPlugin({ inputTarget: canvas, saveProject, exportProject })],
		});
		const state = editor.state;
		await vi.waitFor(() =>
			expect(state.codeBlockRendering.codeBlocks.some(block => block.code.includes('note patch'))).toBe(true)
		);
		editor.pauseRendering();
		canvas.focus();
		const saveKey = new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true });
		canvas.dispatchEvent(saveKey);
		expect(saveKey.defaultPrevented).toBe(true);
		expect(saveProject).toHaveBeenCalledOnce();
		expect(parseProjectSource(saveProject.mock.calls[0][0]).notes[0].code).toContain(
			'Save the current patch to a project file.'
		);
		canvas.dispatchEvent(new MouseEvent('contextmenu', { clientX: 600, clientY: 16, bubbles: true }));
		await vi.waitFor(() => expect(state.contextMenu.items.some(item => item.action === 'exportProject')).toBe(true));
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('project-export-menu');
		const menu = state.contextMenu;
		const index = menu.items.findIndex(item => item.action === 'exportProject');
		const x = menu.x - state.viewport.x + 8;
		const y = menu.y - state.viewport.y + index * state.viewport.hGrid + 8;
		canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
		canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));
		expect(exportProject).toHaveBeenCalledWith(saveProject.mock.calls[0][0], 'project.8f4e');
		expect(state.contextMenu.open).toBe(false);
		editor.dispose();
		const afterDispose = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
		canvas.dispatchEvent(afterDispose);
		expect(afterDispose.defaultPrevented).toBe(false);
		expect(saveProject).toHaveBeenCalledOnce();
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
