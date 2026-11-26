import type { EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { createEditorRenderRegistry, type DrawContext, type MemoryViews, textToGlyphIds } from '@8f4e/web-ui';
import { expect, it, vi } from 'vitest';
import { codeBlockBackgroundPlugin } from './index';

function setup() {
	const codeBlock = createMockCodeBlock({ width: 96, height: 64 });
	const state = createMockState();
	const renderRegistry = createEditorRenderRegistry();
	const drawFill = vi.fn();
	const drawGlyphs = vi.fn();
	const dispose = codeBlockBackgroundPlugin.setup({ renderRegistry } as unknown as EditorPluginContext);
	const render = () =>
		renderRegistry.drawCodeBlock({
			draw: { drawFill, drawGlyphs } as unknown as DrawContext,
			state,
			codeBlock,
			memoryViews: {} as MemoryViews,
		});
	return { codeBlock, state, render, drawFill, drawGlyphs, dispose };
}

it.each([
	['normal', false, false, PALETTE_INDICES.surfaceBase],
	['disabled', true, false, PALETTE_INDICES.surfaceSubdued],
	['dragged', false, true, PALETTE_INDICES.surfaceBase],
	['dragged disabled', true, true, PALETTE_INDICES.surfaceSubdued],
] as const)('draws the %s block surface', (_name, disabled, dragged, color) => {
	const test = setup();
	test.codeBlock.disabled = disabled;
	if (dragged) test.state.project.draggedCodeBlock = test.codeBlock;
	test.render();
	expect(test.drawFill).toHaveBeenCalledExactlyOnceWith(0, 0, color, 96, 64);
	test.dispose();
});

it.each([false, true])('draws block markers and header (selected=%s)', selected => {
	const test = setup();
	test.state.viewport.vGrid = 6;
	test.state.viewport.hGrid = 10;
	if (selected) test.state.project.selectedCodeBlock = test.codeBlock;
	test.render();
	const color = selected ? PALETTE_INDICES.secondaryBase : PALETTE_INDICES.inkBase;
	expect(test.drawGlyphs.mock.calls).toEqual([
		[0, 0, textToGlyphIds('+'), color],
		[90, 0, textToGlyphIds('+'), color],
		[0, 54, textToGlyphIds('+'), color],
		[90, 54, textToGlyphIds('+'), color],
	]);
	expect(test.drawFill.mock.calls).toEqual([
		[0, 0, PALETTE_INDICES.surfaceBase, 96, 64],
		...(selected ? [[0, 0, PALETTE_INDICES.secondaryAlpha30, 96, 10]] : []),
	]);
	expect(test.drawFill.mock.invocationCallOrder.at(-1)).toBeLessThan(test.drawGlyphs.mock.invocationCallOrder[0]);
	test.dispose();
});

it('keeps the selected header aligned with current dimensions and removes it on deselection', () => {
	const test = setup();
	test.state.project.selectedCodeBlock = test.codeBlock;
	test.render();
	test.codeBlock.width = 128;
	test.codeBlock.height = 80;
	test.codeBlock.disabled = true;
	test.state.viewport.vGrid = 8;
	test.state.viewport.hGrid = 16;
	test.drawFill.mockClear();
	test.drawGlyphs.mockClear();
	test.render();
	expect(test.drawFill.mock.calls).toEqual([
		[0, 0, PALETTE_INDICES.surfaceSubdued, 128, 80],
		[0, 0, PALETTE_INDICES.secondaryAlpha30, 128, 16],
	]);
	test.state.project.selectedCodeBlock = createMockCodeBlock();
	test.drawFill.mockClear();
	test.drawGlyphs.mockClear();
	test.render();
	expect(test.drawFill).toHaveBeenCalledExactlyOnceWith(0, 0, PALETTE_INDICES.surfaceSubdued, 128, 80);
	expect(test.drawGlyphs).toHaveBeenCalledTimes(4);
	expect(test.drawGlyphs.mock.calls.every(call => call[3] === PALETTE_INDICES.inkBase)).toBe(true);
	test.dispose();
});

it('uses current dimensions and state and unregisters its drawing on disposal', () => {
	const test = setup();
	test.render();
	test.codeBlock.width = 128;
	test.codeBlock.height = 80;
	test.codeBlock.disabled = true;
	test.render();
	expect(test.drawFill).toHaveBeenLastCalledWith(0, 0, PALETTE_INDICES.surfaceSubdued, 128, 80);
	test.dispose();
	test.drawFill.mockClear();
	test.drawGlyphs.mockClear();
	test.render();
	expect(test.drawFill).not.toHaveBeenCalled();
	expect(test.drawGlyphs).not.toHaveBeenCalled();
});
