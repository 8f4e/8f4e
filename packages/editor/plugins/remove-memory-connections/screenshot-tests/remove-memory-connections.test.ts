import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor } from '@8f4e/editor-core';
import { expect, test, vi } from 'vitest';
import { removeMemoryConnectionsPlugin } from '../src/index';

test('edits the clicked block through its contributed menu', async () => {
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
entry main
module target
; @pos 4 3
float value &source:output
moduleEnd
entryEnd`;
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
			initialProject: parseProjectSource(source),
			plugins: [removeMemoryConnectionsPlugin],
		});
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
		const state = editor.state;
		await vi.waitFor(() =>
			expect(state.codeBlockRendering.codeBlocks.some(block => block.name === 'target')).toBe(true)
		);
		editor.pauseRendering();
		const block = state.codeBlockRendering.codeBlocks.find(block => block.name === 'target')!;
		const mouse = (type: string, x: number, y: number) => {
			const rect = canvas.getBoundingClientRect();
			canvas.dispatchEvent(new MouseEvent(type, { clientX: rect.x + x, clientY: rect.y + y, bubbles: true }));
		};
		const openMenu = async () => {
			mouse('contextmenu', block.x - state.viewport.x + 8, block.y - state.viewport.y + 8);
			await vi.waitFor(() =>
				expect(state.contextMenu.items.some(item => item.action === 'removeConnections')).toBe(true)
			);
		};
		await openMenu();
		const index = state.contextMenu.items.findIndex(item => item.action === 'removeConnections');
		expect(state.contextMenu.items[index].payload?.codeBlock).toBe(block);
		expect(state.contextMenu.items[index].title).toContain('Remove connections');
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('remove-memory-connections-menu');
		const x = state.contextMenu.x - state.viewport.x + 8;
		const y = state.contextMenu.y - state.viewport.y + index * state.viewport.hGrid + 8;
		mouse('mousemove', x, y);
		mouse('mousedown', x, y);
		expect(state.contextMenu.open).toBe(false);
		expect(block.code).toContain('float value');
		await openMenu();
		expect(state.contextMenu.items.find(item => item.action === 'removeConnections')?.disabled).toBe(true);
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
