import initEditor from '@8f4e/editor-core';
import { EMPTY_DEFAULT_PROJECT, serializeToProject } from '@8f4e/editor-state';
import type {} from '@vitest/browser-playwright';
import { expect, test, vi } from 'vitest';
import { cdp } from 'vitest/browser';
import { createTouchInputPlugin } from '../src/index';

test('native one-finger dragging pans without clicking or moving blocks, while taps remain available', async () => {
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
		plugins: [createTouchInputPlugin({ inputTarget: canvas })],
	});
	editor.pauseRendering();
	const rect = canvas.getBoundingClientRect();
	const frame = window.frameElement!.getBoundingClientRect();
	const point = (x: number, y: number, id = 1) => ({
		x: frame.left + rect.left + x,
		y: frame.top + rect.top + y,
		id,
	});
	const points = (x: number, y: number) => [point(x, y)];
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
		const viewport = { x: editor.state.viewport.x, y: editor.state.viewport.y };
		await input.send('Input.dispatchTouchEvent', {
			type: 'touchStart',
			touchPoints: [point(100, 130), point(140, 170, 2)],
		});
		await input.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [point(140, 162), point(180, 202, 2)],
		});
		await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		expect(editor.state.viewport).toMatchObject(viewport);
		expect(pressed).not.toHaveBeenCalled();
		await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(100, 130)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect.poll(() => pressed.mock.calls.length).toBe(1);
	} finally {
		editor.dispose();
		canvas.remove();
	}
});

test('horizontal panning leaves vertical swipes to page scrolling', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	const originalMinHeight = document.body.style.minHeight;
	document.body.style.minHeight = '2000px';
	document.body.append(canvas);
	window.scrollTo(0, 0);
	const editor = await initEditor(canvas, {
		plugins: [createTouchInputPlugin({ inputTarget: canvas, axis: 'horizontal' })],
	});
	editor.pauseRendering();
	const input = cdp();
	const rect = canvas.getBoundingClientRect();
	const frame = window.frameElement!.getBoundingClientRect();
	const point = (x: number, y: number, id = 1) => ({
		x: frame.left + rect.left + x,
		y: frame.top + rect.top + y,
		id,
	});
	const points = (x: number, y: number) => [point(x, y)];
	try {
		const { x, y } = editor.state.viewport;
		await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(100, 130) });
		await input.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: points(120, 132),
		});
		await input.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: points(140, 134),
		});
		await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		expect(editor.state.viewport).toMatchObject({
			x: x - 40,
			y,
		});
		expect(window.scrollY).toBe(0);
		const scrollStart = point(300, 250);
		await input.send('Input.synthesizeScrollGesture', {
			x: scrollStart.x,
			y: scrollStart.y,
			yDistance: -130,
			gestureSourceType: 'touch',
			preventFling: true,
		});
		await expect.poll(() => window.scrollY).toBeGreaterThan(0);
		expect(editor.state.viewport).toMatchObject({
			x: x - 40,
			y,
		});
	} finally {
		editor.dispose();
		canvas.remove();
		document.body.style.minHeight = originalMinHeight;
		window.scrollTo(0, 0);
	}
});
