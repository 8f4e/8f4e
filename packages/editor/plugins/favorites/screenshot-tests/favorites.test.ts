import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EventDispatcher } from '@8f4e/editor-core';
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
	let events!: EventDispatcher;
	try {
		editor = await initEditor(canvas, {
			initialProject: parseProjectSource(source),
			plugins: [
				{
					...favoritesPlugin,
					setup: context => {
						events = context.events;
						return favoritesPlugin.setup(context);
					},
				},
			],
		});
		editor.state.editorMode = 'edit';
		const state = editor.state;
		await vi.waitFor(() =>
			expect(state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'target')).toBe(true)
		);
		editor.pauseRendering();
		const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'target')!;
		const pointer = (type: string, x: number, y: number) => {
			events.dispatch(type, {
				x,
				y,
				movementX: 0,
				movementY: 0,
				altKey: false,
				buttons: type === 'pointerup' ? 0 : 1,
				stopPropagation: false,
				canvasWidth: canvas.width,
				canvasHeight: canvas.height,
			});
		};
		const openMenu = async () => {
			pointer('contextmenu', block.x - state.viewport.x + 8, block.y - state.viewport.y + 8);
			await vi.waitFor(() =>
				expect(state.contextMenu.items.some(item => item.action === 'toggleFavoriteDirective')).toBe(true)
			);
		};
		await openMenu();
		const index = state.contextMenu.items.findIndex(item => item.action === 'toggleFavoriteDirective');
		expect(state.contextMenu.items[index].payload?.codeBlock).toBe(block);
		expect(state.contextMenu.items[index].title).toContain('Favorite');
		events.dispatch('activateContextMenuItem', { index, x: 0, y: 0 });
		expect(state.contextMenu.open).toBe(false);
		expect(block.code).toContain('; @favorite');
		await openMenu();
		expect(state.contextMenu.items.find(item => item.action === 'toggleFavoriteDirective')?.title).toContain(
			'Unfavorite'
		);
		pointer('contextmenu', 600, 300);
		await vi.waitFor(() =>
			expect(state.contextMenu.items.some(item => item.payload?.menu === 'favoritesMenu')).toBe(true)
		);
		const clickItem = (index: number) => events.dispatch('activateContextMenuItem', { index, x: 0, y: 0 });
		clickItem(state.contextMenu.items.findIndex(item => item.payload?.menu === 'favoritesMenu'));
		await vi.waitFor(() =>
			expect(state.contextMenu.items.some(item => item.payload?.creationIndex === block.creationIndex)).toBe(true)
		);
		clickItem(state.contextMenu.items.findIndex(item => item.payload?.creationIndex === block.creationIndex));
		expect(state.contextMenu.open).toBe(false);
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(block);
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
