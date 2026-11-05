import type { EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockState } from '@8f4e/editor-state-testing';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { expect, it, vi } from 'vitest';
import { entryOutlinesPlugin } from './index';

function setup() {
	const state = createMockState({
		codeBlockRendering: { entryBounds: [{ entryName: 'audio', x: 16, y: 64, width: 224, height: 192 }] },
	});
	const drawers = createEditorDrawerRegistry();
	const dispose = entryOutlinesPlugin.setup({ drawers } as unknown as EditorPluginContext);
	const draw = { startGroup: vi.fn(), endGroup: vi.fn(), drawFill: vi.fn(), drawText: vi.fn() };
	const render = () => {
		for (const method of Object.values(draw)) method.mockClear();
		drawers.drawCanvasBackground({ draw: draw as unknown as DrawContext, state, memoryViews: {} as MemoryViews });
	};
	return { state, draw, render, dispose };
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
	expect(test.draw.drawText).toHaveBeenCalledExactlyOnceWith(24, 64, 'audio', PALETTE_INDICES.inkStrong);
	test.dispose();
});

it('reads current bounds and grid dimensions when drawing', () => {
	const test = setup();
	test.render();
	test.state.codeBlockRendering.entryBounds = [{ entryName: 'changed', x: 400, y: 128, width: 100, height: 64 }];
	test.state.viewport.vGrid = 4;
	test.render();
	expect(test.draw.drawFill).toHaveBeenCalledWith(400, 128, PALETTE_INDICES.strokeBase, 100, 1);
	expect(test.draw.drawText).toHaveBeenCalledExactlyOnceWith(404, 128, 'changed', PALETTE_INDICES.inkStrong);
	test.dispose();
});

it('draws no outlines for an empty bounds list', () => {
	const test = setup();
	test.state.codeBlockRendering.entryBounds = [];
	test.render();
	expect(test.draw.drawFill).not.toHaveBeenCalled();
	expect(test.draw.drawText).not.toHaveBeenCalled();
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
