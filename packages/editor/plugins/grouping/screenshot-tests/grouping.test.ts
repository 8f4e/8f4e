import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor } from '@8f4e/editor-core';
import { expect, test, vi } from 'vitest';
import { groupingPlugin } from '../src/index';

test('contributes group menus and drag behavior through the real editor', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.width = '768px';
	canvas.style.height = '512px';
	document.body.appendChild(canvas);
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
			initialEditorMode: 'edit',
			plugins: [groupingPlugin],
			initialProject: parseProjectSource(`8f4e/v1
constants env
; @pos 120 60
constantsEnd
entry main
module source
; @pos 4 3
; @group audio
int value 1
moduleEnd
module destination
; @pos 40 14
; @group audio
int value 2
moduleEnd
entryEnd`),
		});
		editor.pauseRendering();
		const state = editor.state;
		const first = state.codeBlockRendering.codeBlocks.find(block => block.name === 'source')!;
		const second = state.codeBlockRendering.codeBlocks.find(block => block.name === 'destination')!;
		const mouse = (type: string, x: number, y: number, altKey = false) => {
			const rect = canvas.getBoundingClientRect();
			canvas.dispatchEvent(
				new MouseEvent(type, {
					clientX: rect.x + x,
					clientY: rect.y + y,
					bubbles: true,
					altKey,
					buttons: type === 'mouseup' ? 0 : 1,
				})
			);
		};
		const x = first.x - state.viewport.x + 8;
		const y = first.y - state.viewport.y + 8;
		const secondX = second.x;
		mouse('mousedown', x, y);
		mouse('mousemove', x + state.viewport.vGrid, y);
		mouse('mouseup', x + state.viewport.vGrid, y);
		expect(second.x).toBe(secondX + state.viewport.vGrid);
		mouse('contextmenu', first.x - state.viewport.x + 8, first.y - state.viewport.y + 8);
		await expect.poll(() => state.contextMenu.items.some(item => item.action === 'setGroupNonstick')).toBe(true);
		const now = vi.spyOn(performance, 'now').mockReturnValue(0);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('grouping-menu');
		now.mockRestore();
		const index = state.contextMenu.items.findIndex(item => item.action === 'setGroupNonstick');
		const menuX = state.contextMenu.x - state.viewport.x + 8;
		const menuY = state.contextMenu.y - state.viewport.y + index * state.viewport.hGrid + 8;
		mouse('mousemove', menuX, menuY);
		mouse('mousedown', menuX, menuY);
		mouse('mouseup', menuX, menuY);
		expect(first.code).toContain('; @group audio nonstick');
		expect(second.code).toContain('; @group audio nonstick');
		const before = second.x;
		const nextX = first.x - state.viewport.x + 8;
		const nextY = first.y - state.viewport.y + 8;
		mouse('mousedown', nextX, nextY);
		mouse('mousemove', nextX + state.viewport.vGrid, nextY);
		mouse('mouseup', nextX + state.viewport.vGrid, nextY);
		expect(second.x).toBe(before);
	} finally {
		vi.restoreAllMocks();
		editor?.dispose();
		canvas.remove();
	}
});
