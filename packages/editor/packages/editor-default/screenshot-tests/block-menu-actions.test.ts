import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type EditorPluginContext } from '@8f4e/editor-core';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { contextMenuPlugin } from '@8f4e/editor-plugin-context-menu';
import { logBlockInfoPlugin } from '@8f4e/editor-plugin-log-block-info';
import { toggleDisabledPlugin } from '@8f4e/editor-plugin-toggle-disabled';
import { Engine } from 'glugglugglug';
import { expect, test, vi } from 'vitest';

test('composes enable/disable and console inspection with the block menu', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	document.body.append(canvas);
	let context!: EditorPluginContext;
	const editor = await initEditor(canvas, {
		renderer: new Engine(canvas),
		initialProject: parseProjectSource(
			'8f4e/v1\nentry main\nmodule target\n; @pos 12 10\nint value 1\nmoduleEnd\nentryEnd'
		),
		plugins: [
			codeBlockBackgroundPlugin,
			codeRenderingPlugin,
			toggleDisabledPlugin,
			logBlockInfoPlugin,
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
	const log = vi.spyOn(console, 'log').mockImplementation(() => {});
	try {
		context.events.dispatch('enterEditMode');
		const block = editor.state.project.activeLevel.blocks.find(block => block.name === 'target')!;
		const position = {
			x: block.x - editor.state.viewport.x + 8,
			y: block.y - editor.state.viewport.y + 8,
		};
		const openMenu = async (title: string) => {
			context.events.dispatch('contextmenu', position);
			await expect.poll(() => editor.state.contextMenu.items.some(item => item.title === title)).toBe(true);
		};
		const activate = (title: string) =>
			context.events.dispatch('activateContextMenuItem', {
				index: editor.state.contextMenu.items.findIndex(item => item.title === title),
				...position,
			});
		await openMenu('Disable module');
		expect(editor.state.contextMenu.items.map(item => item.title)).toEqual([
			'Disable module',
			'Log module info to console',
		]);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('block-menu-actions');
		activate('Disable module');
		expect(block.disabled).toBe(true);
		await openMenu('Enable module');
		activate('Enable module');
		expect(block.disabled).toBe(false);
		await openMenu('Log module info to console');
		activate('Log module info to console');
		expect(log).toHaveBeenCalledExactlyOnceWith(block);
	} finally {
		log.mockRestore();
		editor.dispose();
		canvas.remove();
	}
});
