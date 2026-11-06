import initEditor, { getEditorBlockId } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { EMPTY_DEFAULT_PROJECT, stopViewportAnimation } from '@8f4e/editor-state';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';
import { expect, test } from 'vitest';
import { entryOutlinesPlugin } from '../src/index';

test.each(['root', 'nested'])('draws entries in the $0 project view', async level => {
	const canvas = document.createElement('canvas');
	canvas.width = 800;
	canvas.height = 400;
	document.body.append(canvas);
	const editor = await initEditor(canvas, {
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			entries: ['audio', 'checks'],
			execution: [
				{ type: 'module', id: 0, entry: 'audio', code: ['module first', '; @pos 12 8', '', 'moduleEnd'] },
				{ type: 'module', id: 1, entry: 'audio', code: ['module second', '; @pos 36 10', '', 'moduleEnd'] },
				{
					...EMPTY_DEFAULT_PROJECT,
					type: 'group',
					id: 2,
					name: 'checks',
					entry: 'checks',
					code: ['group checks', '; @pos 64 8', 'groupEnd'],
					entries: ['child'],
					exposures: [],
					execution: [{ type: 'module', id: 0, entry: 'child', code: ['module nested', '; @pos 12 8', 'moduleEnd'] }],
				},
			],
		},
		plugins: [
			entryOutlinesPlugin,
			{
				id: 'fixture-blocks',
				setup: context => {
					const glyphsByBlock = new WeakMap<object, GlyphIds>();
					const removePreparation = context.layout.subscribe(({ codeBlock }) => {
						glyphsByBlock.set(codeBlock, textToGlyphIds(codeBlock.name));
					});
					const removeDrawer = context.drawers.registerCodeBlockDrawer(({ draw, codeBlock, state }) => {
						if (!codeBlock.entry) return;
						draw.drawFill(0, 0, PALETTE_INDICES.surfaceRaised1, codeBlock.width, codeBlock.height);
						draw.drawGlyphs(
							state.viewport.vGrid,
							state.viewport.hGrid,
							glyphsByBlock.get(codeBlock)!,
							PALETTE_INDICES.inkBase
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
		if (level === 'nested') {
			const group = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'checks')!;
			editor.navigation.openGroup(getEditorBlockId(group));
		}
		stopViewportAnimation(editor.state);
		editor.state.viewport.x = 0;
		editor.state.viewport.y = 0;
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot(`entry-outlines-${level}`);
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
