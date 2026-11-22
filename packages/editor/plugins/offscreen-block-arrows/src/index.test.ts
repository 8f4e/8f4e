import type { EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { createEditorDrawerRegistry, type DrawContext, textToGlyphIds } from '@8f4e/web-ui';
import { expect, it, vi } from 'vitest';
import { offscreenBlockArrowsPlugin } from './index';

function setup() {
	const state = createMockState({ viewport: { x: 0, y: 0, width: 1024, height: 768, vGrid: 8, hGrid: 16 } });
	const drawers = createEditorDrawerRegistry();
	const dispose = offscreenBlockArrowsPlugin.setup({ drawers } as unknown as EditorPluginContext);
	const drawSprite = vi.fn();
	const hasVisibleGlyph = vi.fn((_glyph: number) => true);
	const render = (x: number, y: number, codeBlock = createMockCodeBlock({ x, y })) => {
		drawSprite.mockClear();
		drawers.drawOffscreenCodeBlock(
			{ drawSprite, hasVisibleGlyph } as unknown as DrawContext,
			{ codeBlock, x, y },
			state
		);
	};
	return { state, drawSprite, hasVisibleGlyph, render, dispose };
}

it.each([
	[512, -100, 512, 0, '▲↑^'],
	[1200, 384, 1016, 384, '►→>'],
	[512, 900, 512, 752, '▼↓v'],
	[-100, 384, 0, 384, '◄←<'],
	[1200, -100, 1016, 24, '►→>'],
] as const)('draws an arrow toward (%i, %i)', (x, y, arrowX, arrowY, glyph) => {
	const test = setup();
	const [pointer, arrow, ascii] = textToGlyphIds(glyph);
	test.render(x, y);
	expect(test.drawSprite).toHaveBeenCalledExactlyOnceWith(arrowX, arrowY, pointer, PALETTE_INDICES.secondaryBase);
	test.hasVisibleGlyph.mockImplementation(id => id === arrow);
	test.render(x, y);
	expect(test.drawSprite).toHaveBeenCalledExactlyOnceWith(arrowX, arrowY, arrow, PALETTE_INDICES.secondaryBase);
	test.hasVisibleGlyph.mockReturnValue(false);
	test.render(x, y);
	expect(test.drawSprite).toHaveBeenCalledExactlyOnceWith(arrowX, arrowY, ascii, PALETTE_INDICES.secondaryBase);
	test.dispose();
});

it('uses viewport-relative coordinates and raw viewport edges after panning and resizing', () => {
	const test = setup();
	test.render(1200, 384);
	Object.assign(test.state.viewport, { x: 10, y: 20, width: 125, height: 63 });
	test.render(990, 32);
	expect(test.drawSprite).toHaveBeenCalledExactlyOnceWith(
		117,
		32,
		textToGlyphIds('►')[0],
		PALETTE_INDICES.secondaryBase
	);
	test.render(63, 980);
	expect(test.drawSprite).toHaveBeenCalledExactlyOnceWith(
		63,
		47,
		textToGlyphIds('▼')[0],
		PALETTE_INDICES.secondaryBase
	);
	test.dispose();
});

it('points toward the rendered block rather than its logical position', () => {
	const test = setup();
	test.render(512, -100, createMockCodeBlock({ x: 1200, y: 384 }));
	expect(test.drawSprite).toHaveBeenCalledExactlyOnceWith(
		512,
		0,
		textToGlyphIds('▲')[0],
		PALETTE_INDICES.secondaryBase
	);
	test.dispose();
});

it('isolates editor installations and removes its drawing on disposal', () => {
	const first = setup();
	const second = setup();
	first.dispose();
	first.render(1200, 384);
	second.render(1200, 384);
	expect(first.drawSprite).not.toHaveBeenCalled();
	expect(second.drawSprite).toHaveBeenCalledOnce();
	second.dispose();
});
