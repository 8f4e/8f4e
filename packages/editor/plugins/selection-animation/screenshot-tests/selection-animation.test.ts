import initEditor from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { expect, test, vi } from 'vitest';
import { selectionAnimationPlugin } from '../src/index';

test('renders two phases of the selection animation', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 400;
	canvas.height = 240;
	document.body.append(canvas);
	const editor = await initEditor(canvas, {
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			constants: [{ id: 0, code: ['constants env', '; @pos 100 100', 'constantsEnd'] }],
			execution: [
				{
					type: 'module',
					id: 1,
					entry: 'main',
					code: ['module selected', '; @pos 6 3', 'int value 1', '', 'push value', 'drop', 'moduleEnd'],
				},
			],
		},
		plugins: [
			{
				id: 'fixture-text',
				setup: ({ drawers }) =>
					drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
						codeBlock.code.forEach((line, row) =>
							draw.drawText(state.viewport.vGrid, row * state.viewport.hGrid, line, PALETTE_INDICES.inkBase)
						);
					}),
			},
			selectionAnimationPlugin,
		],
	});
	editor.pauseRendering();
	const state = editor.state;
	state.viewport.x = 0;
	state.viewport.y = 0;
	state.codeBlockRendering.selectedCodeBlock = state.codeBlockRendering.currentProject.blocks.find(
		block => block.name === 'selected'
	);
	const now = vi.spyOn(performance, 'now').mockReturnValue(0);
	try {
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('selection-animation-view-start');
		now.mockReturnValue(160);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('selection-animation-view-advanced');
	} finally {
		now.mockRestore();
		editor.dispose();
		canvas.remove();
	}
});
