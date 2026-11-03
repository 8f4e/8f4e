import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EventDispatcher } from '@8f4e/editor-core';
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
	let events!: EventDispatcher;
	try {
		editor = await initEditor(canvas, {
			initialProject: parseProjectSource(source),
			plugins: [
				{
					...removeMemoryConnectionsPlugin,
					setup: context => {
						events = context.events;
						return removeMemoryConnectionsPlugin.setup(context);
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
		pointer('pointermove', x, y);
		pointer('pointerdown', x, y);
		expect(state.contextMenu.open).toBe(false);
		expect(block.code).toContain('float value');
		await openMenu();
		expect(state.contextMenu.items.find(item => item.action === 'removeConnections')?.disabled).toBe(true);
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
