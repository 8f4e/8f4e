import initEditor, { getEditorBlockId } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';
import { Engine } from 'glugglugglug';
import { expect, test, vi } from 'vitest';
import { selectionAnimationPlugin } from '../src/index';

test('renders two phases of the selection animation', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 400;
	canvas.height = 240;
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
						{
							type: 'module',
							id: 1,
							entry: 'main',
							code: ['module selected', '; @pos 6 3', 'int value 1', '', 'push value', 'drop', 'moduleEnd'],
						},
					],
				},
			],
		},
		plugins: [
			{
				id: 'fixture-text',
				setup: ({ renderRegistry, layout }) => {
					const glyphsByBlock = new WeakMap<object, GlyphIds[]>();
					const removePreparation = layout.subscribe(({ codeBlock }) => {
						glyphsByBlock.set(
							codeBlock,
							codeBlock.displayModel.lines.map(line => textToGlyphIds(line.text))
						);
					});
					const removeDrawer = renderRegistry.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
						codeBlock.code.forEach((line, row) =>
							draw.drawGlyphs(
								state.viewport.vGrid,
								row * state.viewport.hGrid,
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
			selectionAnimationPlugin,
		],
	});
	editor.pauseRendering();
	const state = editor.state;
	const group = state.project.rootLevel.blocks.find(block => block.name === 'fixture')!;
	editor.navigation.openGroup(getEditorBlockId(group));
	state.viewport.x = 0;
	state.viewport.y = 0;
	state.project.selectedCodeBlock = state.project.activeLevel.blocks.find(block => block.name === 'selected');
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
