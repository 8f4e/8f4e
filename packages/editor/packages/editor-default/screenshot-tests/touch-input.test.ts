import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPluginContext } from '@8f4e/editor-core';
import { createDefaultEditorPlugins } from '@8f4e/editor-default';
import { EMPTY_DEFAULT_PROJECT, gapCalculator } from '@8f4e/editor-state';
import type {} from '@vitest/browser-playwright';
import { expect, test, vi } from 'vitest';
import { cdp } from 'vitest/browser';

test('coarse-pointer composition combines two-finger panning with mouse-compatible taps', async () => {
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
						code: ['note target', '; @pos 10 7', 'Drag with two fingers', 'Tap to select this block', 'noteEnd'],
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
		const point = (x: number, y: number, id = 1) => ({
			x: frame.left + rect.left + x,
			y: frame.top + rect.top + y,
			id,
		});
		const points = (x: number, y: number) => [point(x, y), point(x + 40, y + 40, 2)];
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
				await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(100, 130) });
				await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(120, 146) });
				await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(140, 162) });
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

test.each([1, 2] as const)(
	'portrait editor supports touch sliders, %i-finger panning, and fitting dialogs',
	async fingerCount => {
		const input = cdp();
		await input.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
		const project = parseProjectSource(`8f4e/v1
constants env
; @pos 120 60
constantsEnd
entry main
module controls
; @pos 4 3
float gain 0.25
; @slider &gain 0 1 0.01
moduleEnd
entryEnd`);
		const compiled = await compileProject(project, { disableSharedMemory: true });
		const writeMemory = vi.fn();
		const canvas = document.createElement('canvas');
		canvas.width = 390;
		canvas.height = 720;
		canvas.style.outline = 'none';
		document.body.append(canvas);
		let editor: Editor | undefined;
		let context!: EditorPluginContext;
		try {
			editor = await initEditor(canvas, {
				initialProject: project,
				featureFlags: { moduleDragging: false },
				plugins: [
					{
						id: 'test-artifacts',
						setup: services => {
							context = services;
							Object.assign(services.store.getState().compiler.result, {
								memoryPlan: compiled.memoryPlan,
								memoryDefaultsByModuleId: compiled.memoryDefaultsByModuleId,
								compiledModules: compiled.compiledModules,
								compiledFunctions: compiled.compiledFunctions,
							});
							return () => {};
						},
					},
					...createDefaultEditorPlugins({
						canvas,
						storage: { getItem: () => null, setItem: () => {} } as Storage,
						storageKey: 'phone-controls-test',
						touchNavigation: { fingerCount },
						showOpenMenuItem: false,
						renderFrame: () => editor!.renderFrame(),
						getMemory: () => null,
						getCodeBuffer: () => new Uint8Array(),
						getAssertionSites: () => undefined,
						writeMemory,
					}),
				],
			});
			editor.pauseRendering();
			const state = editor.state;
			const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'controls')!;
			await expect.poll(() => block.gaps.get(3)?.size).toBe(2);
			await expect.poll(() => canvas.style.touchAction).toBe(fingerCount === 1 ? 'none' : 'auto');
			const rect = canvas.getBoundingClientRect();
			const frame = window.frameElement!.getBoundingClientRect();
			const point = (x: number, y: number, id = 1) => ({
				x: frame.left + rect.left + x,
				y: frame.top + rect.top + y,
				id,
			});
			const left = block.x + (block.lineNumberColumnWidth + 2) * state.viewport.vGrid - state.viewport.x;
			const width = block.width - (block.lineNumberColumnWidth + 2) * state.viewport.vGrid;
			const y = block.y + (gapCalculator(3, block.gaps) + 1) * state.viewport.hGrid - state.viewport.y + 8;
			const viewport = { x: state.viewport.x, y: state.viewport.y };
			await input.send('Input.dispatchTouchEvent', {
				type: 'touchStart',
				touchPoints: [point(left + width * 0.25, y)],
			});
			await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(left + width * 0.75, y)] });
			await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
			expect(writeMemory).toHaveBeenLastCalledWith(expect.any(Number), 0.75, false);
			expect(state.viewport).toMatchObject(viewport);
			const mousePoint = point(left + width * 0.5, y);
			await input.send('Input.dispatchMouseEvent', {
				type: 'mousePressed',
				x: mousePoint.x,
				y: mousePoint.y,
				button: 'left',
				buttons: 1,
				clickCount: 1,
			});
			await input.send('Input.dispatchMouseEvent', {
				type: 'mouseReleased',
				x: mousePoint.x,
				y: mousePoint.y,
				button: 'left',
				buttons: 0,
				clickCount: 1,
			});
			expect(writeMemory).toHaveBeenLastCalledWith(expect.any(Number), 0.5, false);
			const writes = writeMemory.mock.calls.length;
			const points = (x: number, y: number) => [point(x, y), point(x + 40, y + 40, 2)].slice(0, fingerCount);
			await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(200, 400) });
			await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(240, 432) });
			await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
			expect(state.viewport).toMatchObject({ x: viewport.x - 40, y: viewport.y - 32 });
			expect(writeMemory).toHaveBeenCalledTimes(writes);
			context.events.dispatch('contextmenu', { x: 20, y: 20 });
			await expect.poll(() => state.contextMenu.items.length).toBeGreaterThan(0);
			expect(state.contextMenu.open).toBe(true);
			editor.renderFrame();
			await expect(canvas).toMatchScreenshot('portrait-context-menu');
			state.contextMenu.open = false;
			const allowAudio = vi.fn();
			context.events.on('testAllowAudio', allowAudio);
			context.events.dispatch('addDialog', {
				id: 'phone-audio',
				title: 'Audio Permission',
				text: 'This project plays audio. Tap Allow to enable sound on your device.',
				buttons: [{ title: 'Allow', action: 'testAllowAudio' }],
			});
			expect(state.dialog.x).toBeGreaterThanOrEqual(0);
			expect(state.dialog.x + state.dialog.width).toBeLessThanOrEqual(canvas.width);
			editor.renderFrame();
			await expect(canvas).toMatchScreenshot('portrait-audio-dialog');
			const button = state.dialog.buttons[0];
			await input.send('Input.dispatchTouchEvent', {
				type: 'touchStart',
				touchPoints: [
					point(state.dialog.x + button.x + button.width / 2, state.dialog.y + button.y + button.height / 2),
				],
			});
			await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
			await expect.poll(() => allowAudio.mock.calls.length).toBe(1);
			expect(state.dialogStack).toHaveLength(0);
		} finally {
			editor?.dispose();
			canvas.remove();
			await input.send('Emulation.setTouchEmulationEnabled', { enabled: false });
		}
	}
);
