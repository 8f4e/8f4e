import initEditor, { type EditorPluginContext } from '@8f4e/editor-core';
import type {} from '@vitest/browser-playwright';
import { expect, test, vi } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import { createMouseInputPlugin } from '../src/index';

test.each([true, false])('native mouse input with wheel capture %s', async captureWheel => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	const minHeight = document.body.style.minHeight;
	document.body.style.minHeight = '2000px';
	document.body.append(canvas);
	window.scrollTo(0, 0);
	let context!: EditorPluginContext;
	const pressed = vi.fn();
	const editor = await initEditor(canvas, {
		plugins: [
			createMouseInputPlugin({ inputTarget: canvas, captureWheel }),
			{
				id: 'test-context',
				setup: services => {
					context = services;
					context.events.on('pointerdown', pressed);
					return () => context.events.off('pointerdown', pressed);
				},
			},
		],
	});
	editor.pauseRendering();
	try {
		await userEvent.click(canvas, { position: { x: 20, y: 30 } });
		expect(document.activeElement).toBe(canvas);
		expect(pressed).toHaveBeenCalledWith(expect.objectContaining({ x: 20, y: 30, buttons: 1 }));
		const { x, y } = editor.state.viewport;
		const rect = canvas.getBoundingClientRect();
		const frame = window.frameElement!.getBoundingClientRect();
		await cdp().send('Input.dispatchMouseEvent', {
			type: 'mouseWheel',
			x: frame.left + rect.left + 100,
			y: frame.top + rect.top + 100,
			deltaX: 24,
			deltaY: 32,
		});
		if (captureWheel) {
			await expect.poll(() => editor.state.viewport.x).toBe(x + 24);
			expect(editor.state.viewport.y).toBe(y + 32);
			expect(window.scrollY).toBe(0);
		} else {
			await expect.poll(() => window.scrollY).toBeGreaterThan(0);
			expect(editor.state.viewport).toMatchObject({ x, y });
		}
	} finally {
		editor.dispose();
		canvas.remove();
		document.body.style.minHeight = minHeight;
		window.scrollTo(0, 0);
	}
});
