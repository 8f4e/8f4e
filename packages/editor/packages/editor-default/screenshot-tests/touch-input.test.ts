import initEditor, { type Editor } from '@8f4e/editor-core';
import { createDefaultEditorPlugins } from '@8f4e/editor-default';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import type {} from '@vitest/browser-playwright';
import { expect, test } from 'vitest';
import { cdp } from 'vitest/browser';

test('coarse-pointer composition combines touch panning with mouse-compatible taps', async () => {
	const input = cdp();
	await input.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	document.body.append(canvas);
	let editor: Editor | undefined;
	try {
		expect(window.matchMedia('(pointer: coarse)').matches).toBe(true);
		const plugins = createDefaultEditorPlugins({
			canvas,
			storage: { getItem: () => null, setItem: () => {} } as Storage,
			storageKey: 'touch-input-test',
			showOpenMenuItem: false,
			renderFrame: () => editor!.renderFrame(),
			getMemory: () => null,
			getCodeBuffer: () => new Uint8Array(),
			getAssertionSites: () => undefined,
			writeMemory: () => {},
		});
		editor = await initEditor(canvas, {
			initialProject: {
				...EMPTY_DEFAULT_PROJECT,
				constants: [{ id: 0, code: ['constants env', '; @pos 120 60', 'constantsEnd'] }],
				notes: [
					{
						id: 1,
						code: ['note target', '; @pos 10 7', 'Drag with one finger', 'Tap to select this block', 'noteEnd'],
					},
				],
			},
			plugins,
		});
		editor.pauseRendering();
		const state = editor.state;
		const targetBlock = () => state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'target')!;
		const rect = canvas.getBoundingClientRect();
		const frame = window.frameElement!.getBoundingClientRect();
		const point = (x: number, y: number) => ({ x: frame.left + rect.left + x, y: frame.top + rect.top + y, id: 1 });
		const tap = async (x: number, y: number) => {
			await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(x, y)] });
			await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		};
		await expect
			.poll(async () => {
				const block = targetBlock();
				await tap(block.x - state.viewport.x + 8, block.y - state.viewport.y + 8);
				return state.codeBlockRendering.selectedCodeBlock?.name;
			})
			.toBe('target');
		await tap(20, 20);
		await expect.poll(() => state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		const { x: blockX, y: blockY } = targetBlock();
		const { x, y } = state.viewport;
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('before-touch-pan');
		await expect
			.poll(async () => {
				await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(100, 130)] });
				await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(120, 146)] });
				await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(140, 162)] });
				await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
				return { x: state.viewport.x, y: state.viewport.y };
			})
			.toEqual({ x: x - 40, y: y - 32 });
		const block = targetBlock();
		expect({ x: block.x, y: block.y }).toEqual({ x: blockX, y: blockY });
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('after-touch-pan');
		await tap(block.x - state.viewport.x + 8, block.y - state.viewport.y + 8);
		await expect.poll(() => state.codeBlockRendering.selectedCodeBlock?.name).toBe('target');
	} finally {
		editor?.dispose();
		canvas.remove();
		await input.send('Emulation.setTouchEmulationEnabled', { enabled: false });
	}
});
