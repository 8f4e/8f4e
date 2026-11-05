import initEditor from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { EMPTY_DEFAULT_PROJECT, gapCalculator } from '@8f4e/editor-state';
import { expect, test } from 'vitest';
import { codeBlockBackgroundPlugin } from '../src/index';

test('draws normal, disabled, and dragged block backgrounds below registered fixture text', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 720;
	canvas.height = 384;
	document.body.append(canvas);
	const editor = await initEditor(canvas, {
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			constants: [{ id: 0, code: ['constants env', '; @pos 100 100', 'constantsEnd'] }],
			execution: [
				{ type: 'module', id: 1, entry: 'main', code: ['module normal', '; @pos 3 3', 'int value 1', 'moduleEnd'] },
				{ type: 'module', id: 2, entry: 'main', code: ['module disabled', '; @pos 45 3', '; @disabled', 'moduleEnd'] },
				{ type: 'module', id: 3, entry: 'main', code: ['module dragged', '; @pos 3 13', 'int value 2', 'moduleEnd'] },
			],
		},
		plugins: [
			codeBlockBackgroundPlugin,
			{
				id: 'fixture-text',
				setup: ({ drawers }) =>
					drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
						codeBlock.displayModel.lines.forEach((line, row) =>
							draw.drawText(
								state.viewport.vGrid * 3,
								gapCalculator(row, codeBlock.gaps) * state.viewport.hGrid,
								line.text,
								PALETTE_INDICES.inkBase
							)
						);
					}),
			},
		],
	});
	editor.pauseRendering();
	try {
		editor.state.viewport.x = 0;
		editor.state.viewport.y = 0;
		editor.state.codeBlockRendering.draggedCodeBlock = editor.state.codeBlockRendering.currentProject.blocks.find(
			block => block.name === 'dragged'
		);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('block-backgrounds');
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
