import type { EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { createEditorRenderRegistry, type DrawContext, textToGlyphIds } from '@8f4e/web-ui';
import { expect, it, vi } from 'vitest';
import { offscreenBlockArrowsPlugin } from './index';

function setup() {
	const state = createMockState({ viewport: { x: 0, y: 0, width: 1024, height: 768, vGrid: 8, hGrid: 16 } });
	const renderRegistry = createEditorRenderRegistry();
	const dispose = offscreenBlockArrowsPlugin.setup({ renderRegistry } as unknown as EditorPluginContext);
	const drawGlyphs = vi.fn();
	const render = (x: number, y: number, codeBlock = createMockCodeBlock({ x, y })) => {
		drawGlyphs.mockClear();
		renderRegistry.drawOffscreenCodeBlock({ drawGlyphs } as unknown as DrawContext, { codeBlock, x, y }, state);
	};
	return { state, drawGlyphs, render, dispose };
}

it.each([
	[512, -100, 512, 0, '▲'],
	[1200, 384, 1016, 384, '►'],
	[512, 900, 512, 752, '▼'],
	[-100, 384, 0, 384, '◄'],
	[1200, -100, 1016, 24, '►'],
] as const)('draws an arrow toward (%i, %i)', (x, y, arrowX, arrowY, glyph) => {
	const test = setup();
	test.render(x, y);
	expect(test.drawGlyphs).toHaveBeenCalledExactlyOnceWith(
		arrowX,
		arrowY,
		textToGlyphIds(glyph),
		PALETTE_INDICES.secondaryBase
	);
	test.dispose();
});

it('uses viewport-relative coordinates and raw viewport edges after panning and resizing', () => {
	const test = setup();
	test.render(1200, 384);
	Object.assign(test.state.viewport, { x: 10, y: 20, width: 125, height: 63 });
	test.render(990, 32);
	expect(test.drawGlyphs).toHaveBeenCalledExactlyOnceWith(117, 32, textToGlyphIds('►'), PALETTE_INDICES.secondaryBase);
	test.render(63, 980);
	expect(test.drawGlyphs).toHaveBeenCalledExactlyOnceWith(63, 47, textToGlyphIds('▼'), PALETTE_INDICES.secondaryBase);
	test.dispose();
});

it('points toward the rendered block rather than its logical position', () => {
	const test = setup();
	test.render(512, -100, createMockCodeBlock({ x: 1200, y: 384 }));
	expect(test.drawGlyphs).toHaveBeenCalledExactlyOnceWith(512, 0, textToGlyphIds('▲'), PALETTE_INDICES.secondaryBase);
	test.dispose();
});

it('isolates editor installations and removes its drawing on disposal', () => {
	const first = setup();
	const second = setup();
	first.dispose();
	first.render(1200, 384);
	second.render(1200, 384);
	expect(first.drawGlyphs).not.toHaveBeenCalled();
	expect(second.drawGlyphs).toHaveBeenCalledOnce();
	second.dispose();
});
