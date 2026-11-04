import initEditor from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { EMPTY_DEFAULT_PROJECT, stopViewportAnimation, updateViewport } from '@8f4e/editor-state';
import type { EventDispatcher } from '@8f4e/editor-state-types';
import { expect, test } from 'vitest';
import { entryOutlinesPlugin } from '../src/index';

test.each(['root', 'nested'])('draws entries in the $0 project view', async level => {
	const canvas = document.createElement('canvas');
	canvas.width = 800;
	canvas.height = 400;
	document.body.append(canvas);
	let events!: EventDispatcher;
	const editor = await initEditor(canvas, {
		featureFlags: { offscreenBlockArrows: false },
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
					events = context.events;
					return context.drawers.registerCodeBlockDrawer(({ draw, codeBlock, state }) => {
						if (!codeBlock.entry) return;
						draw.drawFill(0, 0, PALETTE_INDICES.surfaceRaised1, codeBlock.width, codeBlock.height);
						draw.drawText(state.viewport.vGrid, state.viewport.hGrid, codeBlock.name, PALETTE_INDICES.inkBase);
					});
				},
			},
		],
	});
	editor.pauseRendering();
	try {
		if (level === 'nested') {
			const group = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'checks')!;
			events.dispatch('openProjectGroup', { codeBlock: group });
		}
		stopViewportAnimation(editor.state);
		updateViewport(editor.state, 0, 0, events);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot(`entry-outlines-${level}`);
		if (level === 'root') {
			events.dispatch('enterEditMode');
			events.dispatch('insertCodeBlock', { x: 40, y: 80, code: ['module added', 'moduleEnd'] });
			expect(editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'added')!.entry).toBe(
				'audio'
			);
			events.dispatch('insertCodeBlock', { x: 780, y: 390, code: ['module outside', 'moduleEnd'] });
			expect(editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'outside')!.entry).toBe(
				'entry'
			);
		}
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
