import type { EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews, textToGlyphIds } from '@8f4e/web-ui';
import { expect, it, vi } from 'vitest';
import { entryOutlinesPlugin } from './index';

function setup() {
	const state = createMockState({
		codeBlockRendering: { entryBounds: [{ entryName: 'audio', x: 16, y: 64, width: 224, height: 192 }] },
	});
	const drawers = createEditorDrawerRegistry();
	const store = createStateManager(state);
	const dispose = entryOutlinesPlugin.setup({ drawers, store } as unknown as EditorPluginContext);
	const draw = { startGroup: vi.fn(), endGroup: vi.fn(), drawFill: vi.fn(), drawGlyphs: vi.fn() };
	const render = () => {
		for (const method of Object.values(draw)) method.mockClear();
		drawers.drawCanvasBackground({ draw: draw as unknown as DrawContext, state, memoryViews: {} as MemoryViews });
	};
	return {
		state,
		store,
		draw,
		render,
		dispose: () => {
			dispose();
			store.dispose();
		},
	};
}

it('draws borders and labels from core entry bounds in world coordinates', () => {
	const test = setup();
	test.state.viewport.x = 24;
	test.state.viewport.y = 32;
	test.render();
	expect(test.draw.startGroup).toHaveBeenCalledExactlyOnceWith(-24, -32);
	expect(test.draw.drawFill.mock.calls).toEqual([
		[16, 64, PALETTE_INDICES.strokeBase, 224, 1],
		[16, 255, PALETTE_INDICES.strokeBase, 224, 1],
		[16, 64, PALETTE_INDICES.strokeBase, 1, 192],
		[239, 64, PALETTE_INDICES.strokeBase, 1, 192],
	]);
	expect(test.draw.drawGlyphs).toHaveBeenCalledExactlyOnceWith(
		24,
		64,
		textToGlyphIds('audio'),
		PALETTE_INDICES.inkStrong
	);
	test.dispose();
});

it('reads current bounds and grid dimensions when drawing', () => {
	const test = setup();
	test.render();
	test.store.set('codeBlockRendering.entryBounds', [{ entryName: 'changed', x: 400, y: 128, width: 100, height: 64 }]);
	test.state.viewport.vGrid = 4;
	test.render();
	expect(test.draw.drawFill).toHaveBeenCalledWith(400, 128, PALETTE_INDICES.strokeBase, 100, 1);
	expect(test.draw.drawGlyphs).toHaveBeenCalledExactlyOnceWith(
		404,
		128,
		textToGlyphIds('changed'),
		PALETTE_INDICES.inkStrong
	);
	test.dispose();
});

it('draws no outlines for an empty bounds list', () => {
	const test = setup();
	test.store.set('codeBlockRendering.entryBounds', []);
	test.render();
	expect(test.draw.drawFill).not.toHaveBeenCalled();
	expect(test.draw.drawGlyphs).not.toHaveBeenCalled();
	test.dispose();
});

it('reuses prepared glyphs between frames and prepares updated Unicode labels', () => {
	const test = setup();
	test.render();
	const glyphs = test.draw.drawGlyphs.mock.calls[0][2];
	test.render();
	expect(test.draw.drawGlyphs.mock.calls[0][2]).toBe(glyphs);
	test.store.set('codeBlockRendering.entryBounds', [{ entryName: 'éΩ', x: 16, y: 64, width: 224, height: 192 }]);
	test.render();
	expect(test.draw.drawGlyphs.mock.calls[0][2]).toEqual([130, 234]);
	test.dispose();
});

it('isolates installations and removes only its drawing on disposal', () => {
	const first = setup();
	const second = setup();
	first.dispose();
	first.render();
	second.render();
	expect(first.draw.drawFill).not.toHaveBeenCalled();
	expect(second.draw.drawFill).toHaveBeenCalledTimes(4);
	expect(first.state.codeBlockRendering.entryBounds).toHaveLength(1);
	second.dispose();
});
