import initEditor, { getEditorBlockId } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { EMPTY_DEFAULT_PROJECT, gapCalculator } from '@8f4e/editor-state';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import { codeBlockBackgroundPlugin } from '../src/index';

test('draws normal, disabled, dragged, and selected block backgrounds below registered fixture text', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 720;
	canvas.height = 384;
	document.body.append(canvas);
	const editor = await initEditor(canvas, {
		renderer: new Engine(canvas),
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
						{ type: 'module', id: 1, entry: 'main', code: ['module normal', '; @pos 3 3', 'int value 1', 'moduleEnd'] },
						{
							type: 'module',
							id: 2,
							entry: 'main',
							code: ['module disabled', '; @pos 45 3', '; @disabled', 'moduleEnd'],
						},
						{
							type: 'module',
							id: 3,
							entry: 'main',
							code: ['module dragged', '; @pos 3 13', 'int value 2', 'moduleEnd'],
						},
					],
				},
			],
		},
		plugins: [
			codeBlockBackgroundPlugin,
			{
				id: 'fixture-text',
				setup: ({ drawers, layout }) => {
					const glyphsByBlock = new WeakMap<object, GlyphIds[]>();
					const removePreparation = layout.subscribe(({ codeBlock }) => {
						glyphsByBlock.set(
							codeBlock,
							codeBlock.displayModel.lines.map(line => textToGlyphIds(line.text))
						);
					});
					const removeDrawer = drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
						codeBlock.displayModel.lines.forEach((line, row) =>
							draw.drawGlyphs(
								state.viewport.vGrid * 3,
								gapCalculator(row, codeBlock.gaps) * state.viewport.hGrid,
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
		const group = editor.state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'fixture')!;
		editor.navigation.openGroup(getEditorBlockId(group));
		editor.state.viewport.x = 0;
		editor.state.viewport.y = 0;
		editor.state.codeBlockRendering.draggedCodeBlock = editor.state.codeBlockRendering.currentProject.blocks.find(
			block => block.name === 'dragged'
		);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('block-backgrounds');
		editor.state.codeBlockRendering.selectedCodeBlock = editor.state.codeBlockRendering.currentProject.blocks.find(
			block => block.name === 'normal'
		);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('selected-block-background');
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
