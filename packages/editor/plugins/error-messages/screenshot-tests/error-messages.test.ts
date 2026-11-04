import initEditor, { type EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { EMPTY_DEFAULT_PROJECT, gapCalculator } from '@8f4e/editor-state';
import { expect, test } from 'vitest';
import { errorMessagesPlugin } from '../src/index';

test('draws wrapped contributor messages between source rows and clears their reservations', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 480;
	document.body.append(canvas);
	let context!: EditorPluginContext;
	const editor = await initEditor(canvas, {
		featureFlags: { offscreenBlockArrows: false },
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			constants: [{ id: 0, code: ['constants env', '; @pos 100 100', 'constantsEnd'] }],
			execution: [
				{
					type: 'module',
					id: 7,
					entry: 'main',
					code: ['module checks', '; @pos 4 3', 'push 10', 'assertEqual 9', 'drop', 'moduleEnd'],
				},
			],
		},
		plugins: [
			errorMessagesPlugin,
			{
				id: 'fixture-text',
				setup: services => {
					context = services;
					return services.drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
						codeBlock.displayModel.lines.forEach((line, row) =>
							draw.drawText(
								state.viewport.vGrid,
								gapCalculator(row, codeBlock.gaps) * state.viewport.hGrid,
								line.text,
								PALETTE_INDICES.inkBase
							)
						);
					});
				},
			},
		],
	});
	editor.pauseRendering();
	try {
		const state = editor.state;
		state.viewport.x = 0;
		state.viewport.y = 0;
		const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'checks')!;
		const height = block.height;
		context.store.set('codeErrors.fixture-one', [
			{ codeBlockId: block.creationIndex, lineNumber: 3, message: 'Assertion failed: expected 9, received 10' },
		]);
		context.store.set('codeErrors.fixture-two', [
			{
				codeBlockId: block.creationIndex,
				lineNumber: 3,
				message: 'A second contributor can report an error on the same source line.',
			},
		]);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('contributor-errors');
		context.store.set('codeErrors.fixture-one', []);
		context.store.set('codeErrors.fixture-two', []);
		expect(block.gaps.size).toBe(0);
		expect(block.height).toBe(height);
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
