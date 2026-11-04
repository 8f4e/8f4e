import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import type { DrawContext } from '../../drawContext';
import type { MemoryViews } from '../../types';
import { createEditorDrawerRegistry } from '../registry';
import drawCodeBlocks from './index';

function createMemoryViews(): MemoryViews {
	return {
		int8: new Int8Array(0),
		int16: new Int16Array(0),
		int32: new Int32Array(0),
		uint8: new Uint8Array(0),
		uint16: new Uint16Array(0),
		float32: new Float32Array(0),
		float64: new Float64Array(0),
	};
}

function createDrawContext(): DrawContext {
	return {
		startGroup: vi.fn(),
		endGroup: vi.fn(),
		drawFill: vi.fn(),
		drawText: vi.fn(),
	} as unknown as DrawContext;
}

describe('drawCodeBlocks', () => {
	it('runs the ordered registry once inside each visible block and removes only the requested drawer', () => {
		const visible = createMockCodeBlock({ width: 96, height: 64, x: 16, y: 16 });
		const offscreen = createMockCodeBlock({ creationIndex: 1, x: 10000 });
		const state = createMockState({
			codeBlockRendering: { currentProject: { entries: [], path: '', blocks: [visible, offscreen] } },
			featureFlags: { offscreenBlockArrows: false },
		});
		const draw = createDrawContext();
		const memoryViews = createMemoryViews();
		const drawers = createEditorDrawerRegistry();
		const calls: string[] = [];
		drawers.registerCodeBlockDrawer(context => {
			expect(context).toEqual({ draw, state, codeBlock: visible, memoryViews });
			expect(draw.startGroup).toHaveBeenLastCalledWith(visible.x, visible.y);
			calls.push('first');
		});
		const removeSecond = drawers.registerCodeBlockDrawer(() => calls.push('second'));
		drawers.registerCodeBlockDrawer(() => calls.push('third'));
		drawCodeBlocks(draw, state, memoryViews, drawers);
		expect(calls).toEqual(['first', 'second', 'third']);
		removeSecond();
		drawCodeBlocks(draw, state, memoryViews, drawers);
		expect(calls).toEqual(['first', 'second', 'third', 'first', 'third']);
	});

	it('draws precomputed entry outlines before rendering code blocks', () => {
		const state = createMockState({
			codeBlockRendering: {
				currentProject: { entries: [], path: '', blocks: [] },
				entryOutlines: [
					{
						entryName: 'main',
						topLeft: { x: 8, y: 16 },
						topRight: { x: 104, y: 16 },
						bottomRight: { x: 104, y: 96 },
						bottomLeft: { x: 8, y: 96 },
					},
				],
			},
			viewport: {
				vGrid: 8,
				hGrid: 16,
			},
		});
		const draw = createDrawContext();

		drawCodeBlocks(draw, state, createMemoryViews(), createEditorDrawerRegistry());

		expect(vi.mocked(draw.drawFill)).toHaveBeenNthCalledWith(1, 8, 16, PALETTE_INDICES.strokeBase, 96, 1);
		expect(vi.mocked(draw.drawFill)).toHaveBeenNthCalledWith(2, 8, 95, PALETTE_INDICES.strokeBase, 96, 1);
		expect(vi.mocked(draw.drawFill)).toHaveBeenNthCalledWith(3, 8, 16, PALETTE_INDICES.strokeBase, 1, 80);
		expect(vi.mocked(draw.drawFill)).toHaveBeenNthCalledWith(4, 103, 16, PALETTE_INDICES.strokeBase, 1, 80);
		expect(draw.drawText).toHaveBeenCalledWith(16, 16, 'main', PALETTE_INDICES.inkStrong);
	});

	it('can skip off-screen arrow indicators', () => {
		const offscreenBlock = createMockCodeBlock({
			x: 1200,
			y: 384,
			width: 100,
			height: 80,
		});
		const state = createMockState({
			codeBlockRendering: {
				currentProject: { entries: [], path: '', blocks: [offscreenBlock] },
			},
			viewport: {
				width: 1024,
				height: 768,
				vGrid: 8,
				hGrid: 16,
				center: { x: 512, y: 384 },
				borderLineCoordinates: {
					top: { startX: 0, startY: 0, endX: 1024, endY: 0 },
					right: { startX: 1024, startY: 0, endX: 1024, endY: 768 },
					bottom: { startX: 0, startY: 768, endX: 1024, endY: 768 },
					left: { startX: 0, startY: 0, endX: 0, endY: 768 },
				},
			},
			featureFlags: {
				offscreenBlockArrows: false,
			},
		});
		const draw = createDrawContext();

		drawCodeBlocks(draw, state, createMemoryViews(), createEditorDrawerRegistry());

		expect(draw.drawText).not.toHaveBeenCalled();
	});
});
