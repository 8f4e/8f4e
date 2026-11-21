import type { EditorPluginContext, State } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockState } from '@8f4e/editor-state-testing';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { expect, it, vi } from 'vitest';
import { coordinateGridPlugin } from './index';

function setup(viewport: Partial<State['viewport']>) {
	const state = createMockState({ viewport: { x: 0, y: 0, vGrid: 8, hGrid: 16, ...viewport } });
	const drawers = createEditorDrawerRegistry();
	const dispose = coordinateGridPlugin.setup({ drawers } as unknown as EditorPluginContext);
	const draw = { drawFill: vi.fn(), drawNumericText: vi.fn() };
	const presentedViewport = { ...state.viewport };
	const frame = {
		draw: draw as unknown as DrawContext,
		state,
		viewport: presentedViewport,
		memoryViews: {} as MemoryViews,
		renderGeometry: { blocks: [], blocksByCodeBlock: new Map() },
	};
	const render = () => {
		draw.drawFill.mockClear();
		draw.drawNumericText.mockClear();
		drawers.drawCanvasBackground(frame);
	};
	return { state, viewport: presentedViewport, draw, render, dispose };
}

it('places a dot and grid-coordinate label every 100 columns and 50 rows', () => {
	const test = setup({ width: 1700, height: 1700 });
	test.render();
	expect(test.draw.drawFill).toHaveBeenCalledTimes(9);
	expect(test.draw.drawNumericText).toHaveBeenCalledTimes(9);
	expect(test.draw.drawFill).toHaveBeenCalledWith(799, 799, PALETTE_INDICES.mutedBase, 3, 3);
	expect(test.draw.drawNumericText).toHaveBeenCalledWith(805, 802, '100, 50', PALETTE_INDICES.mutedSoft);
	expect(test.draw.drawNumericText).toHaveBeenCalledWith(1605, 1602, '200, 100', PALETTE_INDICES.mutedSoft);
	expect(test.draw.drawNumericText).toHaveBeenCalledWith(5, 2, '0, 0', PALETTE_INDICES.mutedSoft);
});

it('uses signed world-grid coordinates when panning past the origin', () => {
	const test = setup({ x: -1200, y: -1100, width: 500, height: 400 });
	test.render();
	expect(test.draw.drawFill).toHaveBeenCalledExactlyOnceWith(399, 299, PALETTE_INDICES.mutedBase, 3, 3);
	expect(test.draw.drawNumericText).toHaveBeenCalledExactlyOnceWith(405, 302, '-100, -50', PALETTE_INDICES.mutedSoft);
});

it('projects directly from the viewport and leaves a partially visible label attached to its dot', () => {
	const test = setup({ x: 740, y: 750, width: 180, height: 120 });
	test.state.viewport.x = 1600;
	test.state.viewport.y = 1600;
	test.render();
	expect(test.draw.drawFill).toHaveBeenCalledExactlyOnceWith(59, 49, PALETTE_INDICES.mutedBase, 3, 3);
	test.viewport.x += 37;
	test.viewport.y -= 14;
	test.render();
	expect(test.draw.drawFill).toHaveBeenCalledExactlyOnceWith(22, 63, PALETTE_INDICES.mutedBase, 3, 3);
	expect(test.draw.drawNumericText).toHaveBeenCalledExactlyOnceWith(28, 66, '100, 50', PALETTE_INDICES.mutedSoft);
	test.viewport.x = 802;
	test.render();
	expect(test.draw.drawFill).not.toHaveBeenCalled();
	expect(test.draw.drawNumericText).toHaveBeenCalledExactlyOnceWith(3, 66, '100, 50', PALETTE_INDICES.mutedSoft);
	test.viewport.y = 802;
	test.render();
	expect(test.draw.drawNumericText).toHaveBeenCalledExactlyOnceWith(3, 0, '100, 50', PALETTE_INDICES.mutedSoft);
	test.viewport.x = 880;
	test.render();
	expect(test.draw.drawNumericText).not.toHaveBeenCalled();
});

it('updates the pixel spacing and keeps grid labels when the font grid changes', () => {
	const test = setup({ x: 390, y: 390, width: 500, height: 450 });
	test.render();
	expect(test.draw.drawNumericText).toHaveBeenCalledExactlyOnceWith(415, 412, '100, 50', PALETTE_INDICES.mutedSoft);
	test.viewport.vGrid = 4;
	test.viewport.hGrid = 8;
	test.render();
	expect(test.draw.drawNumericText).toHaveBeenCalledWith(15, 12, '100, 50', PALETTE_INDICES.mutedSoft);
});

it('unregisters the background drawing on disposal', () => {
	const test = setup({ width: 400, height: 400 });
	test.render();
	expect(test.draw.drawFill).toHaveBeenCalledOnce();
	test.dispose();
	test.render();
	expect(test.draw.drawFill).not.toHaveBeenCalled();
	expect(test.draw.drawNumericText).not.toHaveBeenCalled();
});
