import initEditor from '@8f4e/editor-core';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { expect, test } from 'vitest';
import { codeRenderingPlugin } from '../src/index';

test('renders nested block highlights below selection and text with disabled and folded blocks', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 960;
	canvas.height = 480;
	document.body.append(canvas);
	const editor = await initEditor(canvas, {
		featureFlags: { offscreenBlockArrows: false },
		plugins: [codeRenderingPlugin],
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			constants: [{ id: 4, code: ['constants env', '; @pos 120 100', 'constantsEnd'] }],
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
	});
	editor.pauseRendering();
	try {
		const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'nested')!;
		editor.state.codeBlockRendering.selectedCodeBlock = block;
		block.cursor.row = 6;
		block.cursor.y = editor.state.viewport.hGrid * 6;
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('block-highlights');
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
