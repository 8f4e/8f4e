import initEditor from '@8f4e/editor-core';
import { EMPTY_DEFAULT_PROJECT, serializeToProject } from '@8f4e/editor-state';
import type {} from '@vitest/browser-playwright';
import { expect, test, vi } from 'vitest';
import { cdp } from 'vitest/browser';
import { createTouchInputPlugin } from '../src/index';

test.each([1, 2] as const)(
	'native %i-finger dragging pans without clicking or moving blocks, while taps remain available',
	async fingerCount => {
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
			plugins: [createTouchInputPlugin({ inputTarget: canvas, fingerCount })],
		});
		editor.pauseRendering();
		const rect = canvas.getBoundingClientRect();
		const frame = window.frameElement!.getBoundingClientRect();
		const point = (x: number, y: number, id = 1) => ({
			x: frame.left + rect.left + x,
			y: frame.top + rect.top + y,
			id,
		});
		const points = (x: number, y: number) => [point(x, y), point(x + 40, y + 40, 2)].slice(0, fingerCount);
		const input = cdp();
		try {
			const source = serializeToProject(editor.state);
			const revision = editor.state.projectChange.revision;
			const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'target')!;
			const { x: blockX, y: blockY } = block;
			const { x, y } = editor.state.viewport;
			await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(100, 130) });
			await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(120, 146) });
			await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(140, 162) });
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
	}
);

test('one-finger horizontal panning leaves vertical swipes to page scrolling', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	const originalMinHeight = document.body.style.minHeight;
	document.body.style.minHeight = '2000px';
	document.body.append(canvas);
	window.scrollTo(0, 0);
	const editor = await initEditor(canvas, {
		plugins: [createTouchInputPlugin({ inputTarget: canvas, fingerCount: 1, axis: 'horizontal' })],
	});
	editor.pauseRendering();
	const input = cdp();
	const rect = canvas.getBoundingClientRect();
	const frame = window.frameElement!.getBoundingClientRect();
	const point = (x: number, y: number) => ({ x: frame.left + rect.left + x, y: frame.top + rect.top + y, id: 1 });
	try {
		expect(canvas.style.touchAction).toBe('pan-y');
		const { x, y } = editor.state.viewport;
		await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(100, 130)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(120, 132)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(140, 134)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		expect(editor.state.viewport).toMatchObject({ x: x - 40, y });
		expect(window.scrollY).toBe(0);
		await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(300, 250)] });
		for (const y of [230, 200, 160, 120]) {
			await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(300, y)] });
		}
		await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect.poll(() => window.scrollY).toBeGreaterThan(0);
		expect(editor.state.viewport).toMatchObject({ x: x - 40, y });
	} finally {
		editor.dispose();
		canvas.remove();
		document.body.style.minHeight = originalMinHeight;
		window.scrollTo(0, 0);
	}
});
