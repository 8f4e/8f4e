import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor } from '@8f4e/editor-core';
import { expect, test, vi } from 'vitest';
import { favoritesPlugin } from '../src/index';

test('edits the clicked block and navigates through its contributed menus', async () => {
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
int value 1
moduleEnd
entryEnd`;
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
			initialProject: parseProjectSource(source),
			plugins: [favoritesPlugin],
		});
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
		const state = editor.state;
		await vi.waitFor(() =>
			expect(state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'target')).toBe(true)
		);
		editor.pauseRendering();
		const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'target')!;
		const mouse = (type: string, x: number, y: number) => {
			const rect = canvas.getBoundingClientRect();
			canvas.dispatchEvent(new MouseEvent(type, { clientX: rect.x + x, clientY: rect.y + y, bubbles: true }));
		};
		const openMenu = async () => {
			mouse('contextmenu', block.x - state.viewport.x + 8, block.y - state.viewport.y + 8);
			await vi.waitFor(() =>
				expect(state.contextMenu.items.some(item => item.action === 'toggleFavoriteDirective')).toBe(true)
			);
		};
		await openMenu();
		const index = state.contextMenu.items.findIndex(item => item.action === 'toggleFavoriteDirective');
		expect(state.contextMenu.items[index].payload?.codeBlock).toBe(block);
		expect(state.contextMenu.items[index].title).toContain('Favorite');
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('favorites-block-menu');
		const x = state.contextMenu.x - state.viewport.x + 8;
		const y = state.contextMenu.y - state.viewport.y + index * state.viewport.hGrid + 8;
		mouse('mousemove', x, y);
		mouse('mousedown', x, y);
		expect(state.contextMenu.open).toBe(false);
		expect(block.code).toContain('; @favorite');
		await openMenu();
		expect(state.contextMenu.items.find(item => item.action === 'toggleFavoriteDirective')?.title).toContain(
			'Unfavorite'
		);
		mouse('contextmenu', 600, 300);
		await vi.waitFor(() =>
			expect(state.contextMenu.items.some(item => item.payload?.menu === 'favoritesMenu')).toBe(true)
		);
		const clickItem = (index: number) => {
			const x = state.contextMenu.x - state.viewport.x + 8;
			const y = state.contextMenu.y - state.viewport.y + index * state.viewport.hGrid + 8;
			mouse('mousemove', x, y);
			mouse('mousedown', x, y);
		};
		clickItem(state.contextMenu.items.findIndex(item => item.payload?.menu === 'favoritesMenu'));
		await vi.waitFor(() =>
			expect(state.contextMenu.items.some(item => item.payload?.creationIndex === block.creationIndex)).toBe(true)
		);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('favorites-navigation');
		clickItem(state.contextMenu.items.findIndex(item => item.payload?.creationIndex === block.creationIndex));
		expect(state.contextMenu.open).toBe(false);
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(block);
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
