import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EventDispatcher } from '@8f4e/editor-core';
import { Engine } from 'glugglugglug';
import { expect, test, vi } from 'vitest';
import { favoritesPlugin } from '../src/index';

test.each(['module', 'group'] as const)(
	'edits the clicked %s and navigates through its contributed menus',
	async type => {
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
${type} target
; @pos 4 3
${type === 'module' ? 'int value 1' : 'entry main\nmodule child\nint value 1\nmoduleEnd\nentryEnd'}
${type}End
entryEnd`;
		let editor: Editor | undefined;
		let events!: EventDispatcher;
		try {
			editor = await initEditor(canvas, {
				renderer: new Engine(canvas),
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
				expect(state.project.activeLevel.blocks.some(block => block.name === 'target')).toBe(true)
			);
			editor.pauseRendering();
			const block = state.project.activeLevel.blocks.find(block => block.name === 'target')!;
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
				expect(state.contextMenu.items).toContainEqual(
					expect.objectContaining({ title: `${type} target`, payload: { creationIndex: block.creationIndex } })
				)
			);
			clickItem(state.contextMenu.items.findIndex(item => item.payload?.creationIndex === block.creationIndex));
			expect(state.contextMenu.open).toBe(false);
			expect(state.project.selectedCodeBlock).toBe(block);
		} finally {
			editor?.dispose();
			canvas.remove();
		}
	}
);
