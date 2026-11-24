import initEditor, { getEditorBlockId } from '@8f4e/editor-core';
import { dottedBackgroundPlugin } from '@8f4e/editor-plugin-dotted-background';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import { codeRenderingPlugin } from '../src/index';

test('renders nested block highlights below selection and text with disabled and folded blocks', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 960;
	canvas.height = 480;
	document.body.append(canvas);
	const editor = await initEditor(canvas, {
		renderer: new Engine(canvas),
		plugins: [dottedBackgroundPlugin, codeRenderingPlugin],
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			execution: [
				{
					...EMPTY_DEFAULT_PROJECT,
					type: 'group',
					id: 4,
					entry: 'main',
					name: 'fixture',
					code: ['group fixture', 'groupEnd'],
					exposures: [],
					execution: [
						{
							type: 'module',
							entry: 'main',
							id: 0,
							code: [
								'module nested',
								'; @pos 4 3',
								'if',
								'push 1',
								'loop',
								'block',
								'push 2',
								'blockEnd',
								'loopEnd',
								'else',
								'push 3',
								'ifEnd',
								'moduleEnd',
							],
						},
						{
							type: 'module',
							entry: 'main',
							id: 1,
							code: ['module disabled', '; @pos 44 3', '; @disabled', 'if', 'push 1', 'ifEnd', 'moduleEnd'],
						},
						{
							type: 'module',
							entry: 'main',
							id: 2,
							code: ['module folded', '; @pos 44 15', 'if', 'push 1', '; @hide', 'push 2', 'ifEnd', 'moduleEnd'],
						},
					],
				},
			],
		},
	});
	editor.pauseRendering();
	try {
		const group = editor.state.project.rootLevel.blocks.find(block => block.name === 'fixture')!;
		editor.navigation.openGroup(getEditorBlockId(group));
		const block = editor.state.project.activeLevel.blocks.find(block => block.name === 'nested')!;
		editor.state.project.selectedCodeBlock = block;
		block.cursor.row = 6;
		block.cursor.y = editor.state.viewport.hGrid * 6;
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('block-highlights');
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
