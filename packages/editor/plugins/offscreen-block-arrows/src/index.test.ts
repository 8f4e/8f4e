import type { EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { createEditorDrawerRegistry, type DrawContext } from '@8f4e/web-ui';
import { expect, it, vi } from 'vitest';
import { offscreenBlockArrowsPlugin } from './index';

function setup() {
	const state = createMockState({ viewport: { x: 0, y: 0, width: 1024, height: 768, vGrid: 8, hGrid: 16 } });
	const drawers = createEditorDrawerRegistry();
	const dispose = offscreenBlockArrowsPlugin.setup({ drawers } as unknown as EditorPluginContext);
	const drawText = vi.fn();
	const render = (x: number, y: number) => {
		drawText.mockClear();
		drawers.drawOffscreenCodeBlock({ drawText } as unknown as DrawContext, createMockCodeBlock({ x, y }), state);
	};
	return { state, drawText, render, dispose };
}

it.each([
	[512, -100, 512, 0, '^'],
	[1200, 384, 1016, 384, '>'],
	[512, 900, 512, 752, 'v'],
	[-100, 384, 0, 384, '<'],
	[1200, -100, 1016, 24, '>'],
] as const)('draws an arrow toward (%i, %i)', (x, y, arrowX, arrowY, glyph) => {
	const test = setup();
	test.render(x, y);
	expect(test.drawText).toHaveBeenCalledExactlyOnceWith(arrowX, arrowY, glyph, PALETTE_INDICES.secondaryBase);
	test.dispose();
});

it('uses current world coordinates and raw viewport edges after panning and resizing', () => {
	const test = setup();
	test.render(1200, 384);
	Object.assign(test.state.viewport, { x: 10, y: 20, width: 125, height: 63, roundedWidth: 120, roundedHeight: 48 });
	test.render(1000, 52);
	expect(test.drawText).toHaveBeenCalledExactlyOnceWith(127, 52, '>', PALETTE_INDICES.secondaryBase);
	test.render(73, 1000);
	expect(test.drawText).toHaveBeenCalledExactlyOnceWith(73, 67, 'v', PALETTE_INDICES.secondaryBase);
	test.dispose();
});

it('isolates editor installations and removes its drawing on disposal', () => {
	const first = setup();
	const second = setup();
	first.dispose();
	first.render(1200, 384);
	second.render(1200, 384);
	expect(first.drawText).not.toHaveBeenCalled();
	expect(second.drawText).toHaveBeenCalledOnce();
	second.dispose();
});
