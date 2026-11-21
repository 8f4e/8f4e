import initEditor from '@8f4e/editor-core';
import { createDefaultEditorPlugins } from '@8f4e/editor-default';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { Engine } from 'glugglugglug';
import { afterEach, expect, test, vi } from 'vitest';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

test('sheds elastic viewport motion under sustained draw load and keeps the coordinate grid', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 320;
	canvas.height = 192;
	canvas.style.cssText = 'width:320px;height:192px';
	document.body.append(canvas);
	cleanups.push(() => canvas.remove());

	const renderer = new Engine(canvas);
	const sprites = vi.spyOn(renderer, 'drawSprite');
	cleanups.push(() => sprites.mockRestore());
	let presentedX: number | undefined;
	const editor = await initEditor(canvas, {
		renderer,
		renderStatsIntervalFrames: 1,
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			constants: [{ id: 0, code: ['constants env', '; @pos 200 100', 'constantsEnd'] }],
			notes: [{ id: 1, code: ['note anchor', '; @pos 10 4', 'noteEnd'] }],
		},
		plugins: [
			// Keep wall-clock-dependent loading messages out of the screenshot, not out of state.
			...createDefaultEditorPlugins({
				canvas,
				storage: { getItem: () => null, setItem: () => {} } as unknown as Storage,
				storageKey: 'adaptive-decorations-test',
				showOpenMenuItem: false,
				renderFrame: () => {},
				getMemory: () => null,
				writeMemory: () => {},
				getCodeBuffer: () => new Uint8Array(),
				getAssertionSites: () => undefined,
			}).filter(plugin => plugin.id !== 'loading-indicators'),
			{
				id: 'decoration-probe',
				setup: ({ drawers }) =>
					drawers.registerCanvasDrawer(({ renderGeometry }) => {
						presentedX = renderGeometry.blocks.find(({ codeBlock }) => codeBlock.name === 'anchor')?.x;
					}),
			},
		],
	});
	cleanups.push(() => editor.dispose());
	editor.pauseRendering();
	const ids = ['coordinate-grid', 'elastic-viewport', 'mouse-input'];
	await expect
		.poll(() => ids.map(id => editor.state.loadingIndicators.find(item => item.id === `plugin:${id}`)?.status))
		.toEqual(['done', 'done', 'done']);
	expect(editor.state.loadingIndicators.some(item => item.id === 'plugin:adaptive-decorations')).toBe(false);

	const { viewport, codeBlockRendering } = editor.state;
	const anchor = codeBlockRendering.currentProject.blocks.find(block => block.name === 'anchor')!;
	viewport.x = -48;
	viewport.y = -16;
	const pan = (deltaX: number) => canvas.dispatchEvent(new WheelEvent('wheel', { deltaX, cancelable: true }));
	const logicalX = () => anchor.x - viewport.x;
	const originMarker = () =>
		sprites.mock.calls
			.find(([, , , color, width, height]) => color === PALETTE_INDICES.mutedBase && width === 3 && height === 3)
			?.slice(0, 2);

	let now = performance.now() + 200;
	let drawTimeMs = 0;
	const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
	cleanups.push(() => clock.mockRestore());
	// Advance the clock inside the real renderer's timed draw interval, without slowing the test runner.
	renderer.hooks.preDraw.push(() => {
		now += drawTimeMs;
	});
	const frame = async (costMs: number) => {
		now += 16;
		drawTimeMs = costMs;
		sprites.mockClear();
		editor.renderFrame();
		await Promise.resolve(); // Unregistration runs after drawing.
	};

	await frame(2);
	pan(12);
	await frame(2);
	expect(viewport.x).toBe(-36);
	expect(presentedX).toBeGreaterThan(logicalX());
	expect(originMarker()).toEqual([35, 15]);

	await frame(20);
	await frame(20);
	pan(8);
	await frame(20);
	expect(presentedX).toBeGreaterThan(logicalX()); // The third slow frame itself still had the effect.
	expect(editor.state.info.graphics?.p90RenderTimeMs).toBe(20);

	pan(8);
	await frame(2);
	expect(viewport.x).toBe(-20);
	expect(presentedX).toBe(logicalX());
	expect(originMarker()).toEqual([19, 15]);
	await expect(canvas).toMatchScreenshot('elastic-off-grid-retained');
});
