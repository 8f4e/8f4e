import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockEventDispatcher, createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import initializeWebUi, { createEditorRenderRegistry, textToGlyphIds } from '@8f4e/web-ui';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import createMockMemoryViews from './utils/createMockMemoryViews';

test('preserves the pixels of a code block as the viewport and visual offset move', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 211;
	canvas.height = 139;
	const engine = new Engine(canvas);
	const block = createMockCodeBlock({ x: 48, y: 48, width: 96, height: 48 });
	const state = createMockState({
		viewport: { width: canvas.width, height: canvas.height },
		project: { activeLevel: { blocks: [block] } },
	});
	const store = createStateManager(state);
	const renderRegistry = createEditorRenderRegistry();
	const glyphs = textToGlyphIds('module test');
	const offset = { x: 0, y: 0 };
	renderRegistry.registerCodeBlockPositionEffect(() => () => offset);
	renderRegistry.registerCodeBlockDrawer(({ draw, codeBlock }) => {
		draw.drawFill(0, 0, PALETTE_INDICES.black, codeBlock.width, codeBlock.height);
		draw.drawGlyphs(0, 16, glyphs, PALETTE_INDICES.white);
	});
	const renderer = await initializeWebUi(store, createMockEventDispatcher(), engine, createMockMemoryViews(), {
		loading: { add: () => ({ done: () => {}, fail: () => {}, cancel: () => {} }) },
		renderRegistry,
	});
	const readBlock = (x: number, y: number) => {
		const pixels = new Uint8Array(block.width * block.height * 4);
		const gl = engine.gl;
		gl.readPixels(x, canvas.height - y - block.height, block.width, block.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		return pixels;
	};
	try {
		renderer.renderFrame(0);
		const reference = readBlock(block.x, block.y);
		expect(reference.some((value, index) => index % 4 === 0 && value === 255)).toBe(true);
		// Exercise the half-pixel cases where glyph sampling can change from one frame to the next.
		for (let step = 1; step <= 8; step++) {
			state.viewport.x = step;
			state.viewport.y = -step;
			offset.x = step * 0.5;
			offset.y = -step * 0.5;
			renderer.renderFrame(step * 16);
			const x = Math.round(block.x - state.viewport.x + offset.x);
			const y = Math.round(block.y - state.viewport.y + offset.y);
			const pixels = readBlock(x, y);
			const differences = pixels.reduce((count, value, index) => count + Number(value !== reference[index]), 0);
			expect(differences, `frame ${step}`).toBe(0);
		}
	} finally {
		renderer.destroy();
		store.dispose();
		engine.gl.getExtension('WEBGL_lose_context')?.loseContext();
	}
});
