import initEditor from '@8f4e/editor-core';
import { EMPTY_DEFAULT_PROJECT, serializeToProject } from '@8f4e/editor-state';
import type {} from '@vitest/browser-playwright';
import { expect, test, vi } from 'vitest';
import { cdp } from 'vitest/browser';
import { createTouchViewportNavigationPlugin } from '../src/index';

test('native dragging pans without clicking or moving blocks, while taps remain available', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	document.body.append(canvas);
	const pressed = vi.fn();
	canvas.addEventListener('mousedown', pressed);
	const editor = await initEditor(canvas, {
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			notes: [{ id: 0, code: ['note target', '; @pos 10 7', 'Touch navigation', 'noteEnd'] }],
		},
		plugins: [createTouchViewportNavigationPlugin({ inputTarget: canvas })],
	});
	editor.pauseRendering();
	const rect = canvas.getBoundingClientRect();
	const frame = window.frameElement!.getBoundingClientRect();
	const point = (x: number, y: number) => ({ x: frame.left + rect.left + x, y: frame.top + rect.top + y, id: 1 });
	const input = cdp();
	try {
		const source = serializeToProject(editor.state);
		const revision = editor.state.projectChange.revision;
		const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'target')!;
		const { x: blockX, y: blockY } = block;
		const { x, y } = editor.state.viewport;
		await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(100, 130)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(120, 146)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(140, 162)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect.poll(() => editor.state.viewport.x).toBe(x - 40);
		expect(editor.state.viewport.y).toBe(y - 32);
		expect({ x: block.x, y: block.y }).toEqual({ x: blockX, y: blockY });
		expect(pressed).not.toHaveBeenCalled();
		expect(serializeToProject(editor.state)).toEqual(source);
		expect(editor.state.projectChange.revision).toBe(revision);
		await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(100, 130)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect.poll(() => pressed.mock.calls.length).toBe(1);
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
