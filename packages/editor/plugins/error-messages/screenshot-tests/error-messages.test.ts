import initEditor, { type EditorPluginContext, getEditorBlockId } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { displayRowToGridRow, EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';
import { createAsciiCanvasRenderer, readAsciiViewport } from '@8f4e/web-ui-testing';
import { expect, test } from 'vitest';
import { errorMessagesPlugin } from '../src/index';

test('draws wrapped contributor messages between source rows and clears their reservations', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 480;
	document.body.append(canvas);
	let context!: EditorPluginContext;
	const editor = await initEditor(canvas, {
		renderer: createAsciiCanvasRenderer(canvas),
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			execution: [
				{
					...EMPTY_DEFAULT_PROJECT,
					type: 'group',
					id: 0,
					entry: 'main',
					name: 'fixture',
					code: ['group fixture', 'groupEnd'],
					exposures: [],
					execution: [
						{
							type: 'module',
							id: 7,
							entry: 'main',
							code: ['module checks', '; @pos 4 3', 'push 10', 'assertEqual 9', 'drop', 'moduleEnd'],
						},
					],
				},
			],
		},
		plugins: [
			errorMessagesPlugin,
			{
				id: 'fixture-text',
				setup: services => {
					context = services;
					const glyphsByBlock = new WeakMap<object, GlyphIds[]>();
					const removePreparation = services.layout.subscribe(({ codeBlock }) => {
						glyphsByBlock.set(
							codeBlock,
							codeBlock.displayModel.lines.map(line => textToGlyphIds(line.text))
						);
					});
					const removeDrawer = services.drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
						codeBlock.displayModel.lines.forEach((line, row) =>
							draw.drawGlyphs(
								state.viewport.vGrid,
								displayRowToGridRow(row, codeBlock.gaps) * state.viewport.hGrid,
								glyphsByBlock.get(codeBlock)![row],
								PALETTE_INDICES.inkBase
							)
						);
					});
					return () => {
						removePreparation();
						removeDrawer();
					};
				},
			},
		],
	});
	editor.pauseRendering();
	try {
		const state = editor.state;
		const group = state.project.rootLevel.blocks.find(block => block.name === 'fixture')!;
		editor.navigation.openGroup(getEditorBlockId(group));
		state.viewport.x = 0;
		state.viewport.y = 0;
		const block = state.project.activeLevel.blocks.find(block => block.name === 'checks')!;
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
		await expect(readAsciiViewport(canvas)).toMatchFileSnapshot('./__snapshots__/contributor-errors.viewport.snap');
		context.store.set('codeErrors.fixture-one', []);
		context.store.set('codeErrors.fixture-two', []);
		expect(block.gaps.size).toBe(0);
		expect(block.height).toBe(height);
		context.store.set('codeErrors.fixture-global', [{ message: 'Internal compiler error: worker unavailable' }]);
		editor.renderFrame();
		await expect(readAsciiViewport(canvas)).toMatchFileSnapshot('./__snapshots__/unlocated-error.viewport.snap');
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
