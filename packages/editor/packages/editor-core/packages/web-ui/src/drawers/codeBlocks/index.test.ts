import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import type { DrawContext } from '../../drawContext';
import { createRenderGeometry } from '../../render-geometry';
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
	} as unknown as DrawContext;
}

describe('drawCodeBlocks', () => {
	it('runs the ordered registry once inside each visible block and removes only the requested drawer', () => {
		const visible = createMockCodeBlock({ width: 96, height: 64, x: 16, y: 16 });
		const offscreen = createMockCodeBlock({ creationIndex: 1, x: 10000 });
		const state = createMockState({
			viewport: { x: 8, y: -16 },
			project: { activeLevel: { entries: [], path: '', blocks: [visible, offscreen] } },
		});
		const renderGeometry = createRenderGeometry().prepare(state);
		const draw = createDrawContext();
		const memoryViews = createMemoryViews();
		const drawers = createEditorDrawerRegistry();
		const calls: string[] = [];
		drawers.registerCodeBlockDrawer(context => {
			expect(context).toEqual({ draw, state, codeBlock: visible, memoryViews });
			expect(context.codeBlock).toBe(visible);
			expect(draw.startGroup).toHaveBeenLastCalledWith(8, 32);
			calls.push('first');
		});
		const removeSecond = drawers.registerCodeBlockDrawer(() => calls.push('second'));
		drawers.registerCodeBlockDrawer(() => calls.push('third'));
		drawCodeBlocks(draw, state, memoryViews, drawers, renderGeometry);
		expect(calls).toEqual(['first', 'second', 'third']);
		removeSecond();
		drawCodeBlocks(draw, state, memoryViews, drawers, renderGeometry);
		expect(calls).toEqual(['first', 'second', 'third', 'first', 'third']);
	});

	it('calls visible and offscreen drawers in the same block traversal', () => {
		const offscreen = createMockCodeBlock({ x: 1200 });
		const visible = createMockCodeBlock({ creationIndex: 1, x: 24, y: 32 });
		const lastOffscreen = createMockCodeBlock({ creationIndex: 2, y: -1200 });
		const state = createMockState({
			project: {
				activeLevel: { entries: [], path: '', blocks: [offscreen, visible, lastOffscreen] },
			},
		});
		const renderGeometry = createRenderGeometry().prepare(state);
		const draw = createDrawContext();
		const drawers = createEditorDrawerRegistry();
		const calls: string[] = [];
		drawers.registerOffscreenCodeBlockDrawer((context, renderedBlock, currentState) => {
			expect(context).toBe(draw);
			expect(currentState).toBe(state);
			expect(renderedBlock).toBe(renderGeometry.blocksByCodeBlock.get(renderedBlock.codeBlock));
			calls.push(renderedBlock.codeBlock === offscreen ? 'offscreen' : 'last offscreen');
		});
		drawers.registerCodeBlockDrawer(() => calls.push('visible'));
		drawCodeBlocks(draw, state, createMemoryViews(), drawers, renderGeometry);
		expect(calls).toEqual(['offscreen', 'visible', 'last offscreen']);
		expect(draw.startGroup).toHaveBeenCalledExactlyOnceWith(24 - state.viewport.x, 32 - state.viewport.y);
		expect(draw.endGroup).toHaveBeenCalledOnce();

		state.featureFlags.canvasOverlays = false;
		calls.length = 0;
		drawCodeBlocks(draw, state, createMemoryViews(), drawers, renderGeometry);
		expect(calls).toEqual(['visible']);
	});

	it('uses presented positions for both culling and local coordinates, independent of editor-state positions', () => {
		const logicalOffscreen = createMockCodeBlock({ x: 3000, y: 20 });
		const logicalVisible = createMockCodeBlock({ x: 20, y: 30 });
		const state = createMockState({
			project: { activeLevel: { blocks: [logicalOffscreen, logicalVisible] } },
		});
		const blocks = [
			{ codeBlock: logicalOffscreen, x: 5, y: 15 },
			{ codeBlock: logicalVisible, x: 3000, y: 20 },
		];
		const renderGeometry = { blocks, blocksByCodeBlock: new Map(blocks.map(block => [block.codeBlock, block])) };
		const draw = createDrawContext();
		const memoryViews = createMemoryViews();
		const drawers = createEditorDrawerRegistry();
		const visible = vi.fn();
		const offscreen = vi.fn();
		drawers.registerCodeBlockDrawer(visible);
		drawers.registerOffscreenCodeBlockDrawer(offscreen);

		drawCodeBlocks(draw, state, memoryViews, drawers, renderGeometry);

		expect(draw.startGroup).toHaveBeenCalledExactlyOnceWith(5, 15);
		expect(visible).toHaveBeenCalledExactlyOnceWith({ draw, state, codeBlock: logicalOffscreen, memoryViews });
		expect(offscreen).toHaveBeenCalledExactlyOnceWith(draw, blocks[1], state);
		expect(logicalOffscreen.x).toBe(3000);
		expect(logicalVisible.x).toBe(20);
	});

	it('replaces the offscreen drawer and clears only the current registration on disposal', () => {
		const drawers = createEditorDrawerRegistry();
		const draw = createDrawContext();
		const state = createMockState();
		const codeBlock = createMockCodeBlock({ x: 10000 });
		const block = { codeBlock, x: 10000, y: 0 };
		const first = vi.fn();
		const second = vi.fn();
		drawers.drawOffscreenCodeBlock(draw, block, state);
		const removeFirst = drawers.registerOffscreenCodeBlockDrawer(first);
		const removeSecond = drawers.registerOffscreenCodeBlockDrawer(second);
		removeFirst();
		drawers.drawOffscreenCodeBlock(draw, block, state);
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledExactlyOnceWith(draw, block, state);
		removeSecond();
		drawers.drawOffscreenCodeBlock(draw, block, state);
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledOnce();
	});

	it('does not restore an overwritten offscreen drawer', () => {
		const drawers = createEditorDrawerRegistry();
		const first = vi.fn();
		drawers.registerOffscreenCodeBlockDrawer(first);
		const removeCurrent = drawers.registerOffscreenCodeBlockDrawer(vi.fn());
		removeCurrent();
		drawers.drawOffscreenCodeBlock(
			createDrawContext(),
			{ codeBlock: createMockCodeBlock(), x: 0, y: 0 },
			createMockState()
		);
		expect(first).not.toHaveBeenCalled();
	});
});
