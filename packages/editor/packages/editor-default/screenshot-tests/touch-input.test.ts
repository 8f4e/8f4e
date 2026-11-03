import initEditor, { type Editor, type EditorPluginContext } from '@8f4e/editor-core';
import { createDefaultEditorPlugins } from '@8f4e/editor-default';
import { EMPTY_DEFAULT_PROJECT, serializeToProject } from '@8f4e/editor-state';
import type {} from '@vitest/browser-playwright';
import { expect, test, vi } from 'vitest';
import { cdp } from 'vitest/browser';

test('coarse-pointer composition combines touch panning with mouse-compatible taps', async () => {
	const input = cdp();
	await input.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	document.body.append(canvas);
	const listeners = vi.spyOn(canvas, 'addEventListener');
	const pressed = vi.fn();
	let editor: Editor | undefined;
	let context!: EditorPluginContext;
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
			plugins: [
				...plugins,
				{
					id: 'test-context',
					setup: services => {
						context = services;
						context.events.on('codeBlockPointerDown', pressed);
						return () => context.events.off('codeBlockPointerDown', pressed);
					},
				},
			],
		});
		editor.pauseRendering();
		await expect.poll(() => canvas.style.touchAction).toBe('none');
		await expect.poll(() => listeners.mock.calls.some(([type]) => type === 'mousedown')).toBe(true);
		await vi.dynamicImportSettled();
		const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'target')!;
		const source = serializeToProject(editor.state);
		const revision = editor.editing.getRevision();
		const { x: blockX, y: blockY } = block;
		const { x, y } = editor.state.viewport;
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('before-touch-pan');
		const rect = canvas.getBoundingClientRect();
		const frame = window.frameElement!.getBoundingClientRect();
		const point = (x: number, y: number) => ({ x: frame.left + rect.left + x, y: frame.top + rect.top + y, id: 1 });
		await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(100, 130)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(120, 146)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(140, 162)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect.poll(() => editor!.state.viewport.x).toBe(x - 40);
		expect(editor.state.viewport.y).toBe(y - 32);
		expect({ x: block.x, y: block.y }).toEqual({ x: blockX, y: blockY });
		expect(pressed).not.toHaveBeenCalled();
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('after-touch-pan');
		const tap = point(block.x - editor.state.viewport.x + 8, block.y - editor.state.viewport.y + 8);
		await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tap] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect.poll(() => pressed.mock.calls.length).toBe(1);
		expect(editor.state.codeBlockRendering.selectedCodeBlock).toBe(block);
		expect(serializeToProject(editor.state)).toEqual(source);
		expect(editor.editing.getRevision()).toBe(revision);
	} finally {
		editor?.dispose();
		listeners.mockRestore();
		canvas.remove();
		await input.send('Emulation.setTouchEmulationEnabled', { enabled: false });
	}
});
