import initEditor, { type Editor } from '@8f4e/editor-core';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import type {} from '@vitest/browser-playwright';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import { cdp } from 'vitest/browser';
import { createMouseInputPlugin } from '../src/index';

test('wheel scrolling pans the viewport while a block is held without moving or editing the block', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	document.body.append(canvas);
	let editor: Editor | undefined;
	const input = cdp();
	try {
		editor = await initEditor(canvas, {
			renderer: new Engine(canvas),
			initialProject: {
				...EMPTY_DEFAULT_PROJECT,
				notes: [{ id: 1, code: ['note target', '; @pos 10 7', '; @mode edit', 'Wheel probe', 'noteEnd'] }],
			},
			plugins: [createMouseInputPlugin({ inputTarget: canvas })],
		});
		editor.pauseRendering();
		const state = editor.state;
		const block = state.project.activeLevel.blocks.find(item => item.name === 'target')!;
		expect(state.editorMode).toBe('edit');
		const viewport = { x: state.viewport.x, y: state.viewport.y };
		const blockPosition = { x: block.x, y: block.y };
		const code = [...block.code];
		const revision = state.projectChange.revision;
		const rect = canvas.getBoundingClientRect();
		const frame = window.frameElement!.getBoundingClientRect();
		const point = {
			x: frame.left + rect.left + block.x - viewport.x + 8,
			y: frame.top + rect.top + block.y - viewport.y + 8,
		};
		await input.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point, buttons: 0 });
		await input.send('Input.dispatchMouseEvent', {
			type: 'mousePressed',
			...point,
			button: 'left',
			buttons: 1,
			clickCount: 1,
		});
		try {
			await expect.poll(() => state.project.draggedCodeBlock?.name).toBe('target');
			await input.send('Input.dispatchMouseEvent', {
				type: 'mouseWheel',
				...point,
				buttons: 1,
				deltaX: 17,
				deltaY: 31,
			});
			await expect
				.poll(() => ({ viewport: { x: state.viewport.x, y: state.viewport.y }, block: { x: block.x, y: block.y } }))
				.toEqual({ viewport: { x: viewport.x + 17, y: viewport.y + 31 }, block: blockPosition });
		} finally {
			await input.send('Input.dispatchMouseEvent', {
				type: 'mouseReleased',
				...point,
				button: 'left',
				buttons: 0,
				clickCount: 1,
			});
		}
		expect(state.project.draggedCodeBlock).toBeUndefined();
		expect(block).toMatchObject(blockPosition);
		expect(block.code).toEqual(code);
		expect(state.projectChange.revision).toBe(revision);
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
