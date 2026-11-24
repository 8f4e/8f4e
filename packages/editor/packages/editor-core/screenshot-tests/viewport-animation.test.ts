import initEditor, { type EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { EMPTY_DEFAULT_PROJECT, jumpToCodeBlock } from '@8f4e/editor-state';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';
import { createAsciiCanvasRenderer, readAsciiViewport } from '@8f4e/web-ui-testing';
import { expect, test, vi } from 'vitest';

test('draws blocks entering the viewport during navigation and culls blocks leaving it', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 320;
	canvas.height = 192;
	canvas.style.cssText = 'width:320px;height:192px;image-rendering:pixelated';
	document.body.append(canvas);
	let context!: EditorPluginContext;
	const visible: string[] = [];
	const presented = { x: 0, y: 0 };
	const editor = await initEditor(canvas, {
		renderer: createAsciiCanvasRenderer(canvas),
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			notes: [
				{ id: 1, code: ['note start', '; @pos 4 4', 'noteEnd'] },
				{ id: 2, code: ['note middle', '; @pos 80 4', 'noteEnd'] },
				{ id: 3, code: ['note destination', '; @pos 142 6', 'noteEnd'] },
			],
		},
		plugins: [
			{
				id: 'visible-blocks',
				setup: services => {
					context = services;
					const glyphsByBlock = new WeakMap<object, GlyphIds>();
					const removePreparation = services.layout.subscribe(({ codeBlock }) => {
						glyphsByBlock.set(codeBlock, textToGlyphIds(codeBlock.name));
					});
					const removeDrawer = services.renderRegistry.registerCodeBlockDrawer(({ draw, codeBlock }) => {
						visible.push(codeBlock.name);
						draw.drawGlyphs(8, 16, glyphsByBlock.get(codeBlock)!, PALETTE_INDICES.inkBase);
					});
					const removeCameraProbe = services.renderRegistry.registerCanvasBackgroundDrawer(({ viewport }) => {
						presented.x = viewport.x;
						presented.y = viewport.y;
					});
					return () => {
						removePreparation();
						removeDrawer();
						removeCameraProbe();
					};
				},
			},
		],
	});
	editor.pauseRendering();
	const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
	try {
		const state = editor.state;
		const destination = state.project.activeLevel.blocks.find(block => block.name === 'destination')!;
		const viewportChanged = vi.fn();
		context.events.on('viewportChanged', viewportChanged);
		jumpToCodeBlock(context.store, destination.creationIndex, context.events);
		const { x, y } = state.viewport;
		expect(x).toBeGreaterThan(0);
		expect(state.project.selectedCodeBlock).toBe(destination);
		visible.length = 0;
		editor.renderFrame();
		expect(visible).toEqual(['env', 'start']);
		expect(presented).toEqual({ x: 0, y: 0 });
		const pointer = {
			x: destination.x - x + 4,
			y: destination.y - y + 4,
			movementX: 0,
			movementY: 0,
			buttons: 1,
			stopPropagation: false,
			altKey: false,
			canvasWidth: canvas.width,
			canvasHeight: canvas.height,
		};
		const onBlockPress = vi.fn();
		context.events.on('codeBlockPointerDown', onBlockPress, { capture: true });
		context.events.dispatch('pointerdown', { ...pointer }, { phase: 'capture' });
		expect(onBlockPress).not.toHaveBeenCalled();

		now.mockReturnValue(1100);
		visible.length = 0;
		editor.renderFrame();
		expect(presented).toEqual({ x: Math.round(x / 2), y: Math.round(y / 2) });
		expect(visible).toEqual(['middle']);
		await expect(readAsciiViewport(canvas)).toMatchFileSnapshot('./__snapshots__/mid-navigation.viewport.snap');

		now.mockReturnValue(1200);
		visible.length = 0;
		editor.renderFrame();
		expect(presented).toEqual({ x, y });
		expect(state.viewport).toMatchObject({ x, y });
		expect(viewportChanged).toHaveBeenCalledExactlyOnceWith({ previousX: 0, previousY: 0, x, y, source: 'navigation' });
		expect(visible).toEqual(['destination']);
		context.events.dispatch('pointerdown', { ...pointer }, { phase: 'capture' });
		expect(onBlockPress).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ codeBlock: destination }));
	} finally {
		now.mockRestore();
		editor.dispose();
		canvas.remove();
	}
});
