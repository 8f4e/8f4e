import initEditor, { type EditorPluginContext } from '@8f4e/editor-core';
import { blockAuthoringPlugin } from '@8f4e/editor-plugin-block-authoring';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { contextMenuPlugin } from '@8f4e/editor-plugin-context-menu';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { expect, test, vi } from 'vitest';

test('creates and deletes a block through authoring contributions and menu presentation', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 800;
	canvas.height = 480;
	document.body.append(canvas);
	let context!: EditorPluginContext;
	const editor = await initEditor(canvas, {
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			constants: [{ id: 0, code: ['constants env', '; @pos 100 60', 'constantsEnd'] }],
		},
		plugins: [
			codeBlockBackgroundPlugin,
			codeRenderingPlugin,
			blockAuthoringPlugin,
			contextMenuPlugin,
			{
				id: 'fixture-context',
				setup: services => {
					context = services;
					return () => {};
				},
			},
		],
	});
	editor.pauseRendering();
	const random = vi.spyOn(Math, 'random').mockReturnValue(0);
	try {
		context.events.dispatch('enterEditMode');
		context.events.dispatch('contextmenu', { x: 160, y: 112 });
		await expect.poll(() => editor.state.contextMenu.items.some(item => item.title === 'New Module')).toBe(true);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('block-authoring-new-menu');
		context.events.dispatch('activateContextMenuItem', {
			index: editor.state.contextMenu.items.findIndex(item => item.title === 'New Module'),
			x: 160,
			y: 112,
		});
		const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'quark')!;
		expect(block.code).toEqual(['module quark', '; @pos 20 7', '', '', 'moduleEnd']);
		const x = block.x + block.width - editor.state.viewport.vGrid;
		const y = block.y + block.height - editor.state.viewport.hGrid;
		context.events.dispatch('contextmenu', { x, y });
		await expect.poll(() => editor.state.contextMenu.items.some(item => item.action === 'deleteCodeBlock')).toBe(true);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('block-authoring-delete-menu');
		context.events.dispatch('activateContextMenuItem', {
			index: editor.state.contextMenu.items.findIndex(item => item.action === 'deleteCodeBlock'),
			x,
			y,
		});
		expect(editor.state.codeBlockRendering.currentProject.blocks).not.toContain(block);
	} finally {
		random.mockRestore();
		editor.dispose();
		canvas.remove();
	}
});
