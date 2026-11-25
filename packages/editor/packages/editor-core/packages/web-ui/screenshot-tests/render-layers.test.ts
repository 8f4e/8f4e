import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockEventDispatcher, createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import initializeWebUi, { createEditorRenderRegistry, type RenderLayerFactory } from '@8f4e/web-ui';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import createMockMemoryViews from './utils/createMockMemoryViews';

test('renders no implicit background and allows layers before and after sprites to be replaced', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 16;
	const engine = new Engine(canvas);
	const state = createMockState({ viewport: { width: 16, height: 16 } });
	const store = createStateManager(state);
	const renderRegistry = createEditorRenderRegistry();
	renderRegistry.registerCanvasBackgroundDrawer(({ draw }) => draw.drawFill(0, 0, PALETTE_INDICES.white, 8, 8));
	const clearLayer =
		(color: [number, number, number, number]): RenderLayerFactory =>
		({ gl }) => ({
			draw: () => {
				gl.clearColor(...color);
				gl.clear(gl.COLOR_BUFFER_BIT);
			},
			destroy: () => {},
		});
	const pixel = (x: number, y: number) => {
		const rgba = new Uint8Array(4);
		engine.gl.readPixels(x, 15 - y, 1, 1, engine.gl.RGBA, engine.gl.UNSIGNED_BYTE, rgba);
		return [...rgba];
	};
	const renderer = await initializeWebUi(store, createMockEventDispatcher(), engine, createMockMemoryViews(), {
		loading: { add: () => ({ done: () => {}, fail: () => {}, cancel: () => {} }) },
		renderRegistry,
	});
	try {
		renderer.renderFrame();
		expect(pixel(2, 2)).toEqual([255, 255, 255, 255]);
		expect(pixel(12, 12)).toEqual([0, 0, 0, 0]);

		const removeBlue = renderRegistry.registerRenderLayer('beforeSprites', clearLayer([0, 0, 1, 1]));
		renderer.renderFrame();
		expect(pixel(2, 2)).toEqual([255, 255, 255, 255]);
		expect(pixel(12, 12)).toEqual([0, 0, 255, 255]);

		const removeGreen = renderRegistry.registerRenderLayer('beforeSprites', clearLayer([0, 1, 0, 1]));
		renderer.renderFrame();
		expect(pixel(2, 2)).toEqual([255, 255, 255, 255]);
		expect(pixel(12, 12)).toEqual([0, 255, 0, 255]);
		removeGreen();
		removeBlue();

		const removeRed = renderRegistry.registerRenderLayer('afterSprites', clearLayer([1, 0, 0, 1]));
		renderer.renderFrame();
		expect(pixel(2, 2)).toEqual([255, 0, 0, 255]);
		removeRed();
		renderer.renderFrame();
		expect(pixel(2, 2)).toEqual([255, 255, 255, 255]);
		expect(pixel(12, 12)).toEqual([0, 0, 0, 0]);
	} finally {
		renderer.destroy();
		store.dispose();
		engine.gl.getExtension('WEBGL_lose_context')?.loseContext();
	}
});
