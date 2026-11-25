import { createMockCodeBlock, createMockState, createMockViewport } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import type { MemoryViews } from '../memoryViews';
import type { DrawContext } from '../sprites/drawContext';
import { createFrameBlockPositions } from './blockPositions';
import drawCodeBlocks from './drawCodeBlocks';
import { createEditorRenderRegistry } from './renderRegistry';

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
		const blockPositions = createFrameBlockPositions().prepare(state.project.activeLevel.blocks, state.viewport);
		const draw = createDrawContext();
		const memoryViews = createMemoryViews();
		const renderRegistry = createEditorRenderRegistry();
		const calls: string[] = [];
		renderRegistry.registerCodeBlockDrawer(context => {
			expect(context).toEqual({ draw, state, codeBlock: visible, memoryViews });
			expect(context.codeBlock).toBe(visible);
			expect(draw.startGroup).toHaveBeenLastCalledWith(8, 32);
			calls.push('first');
		});
		const removeSecond = renderRegistry.registerCodeBlockDrawer(() => calls.push('second'));
		renderRegistry.registerCodeBlockDrawer(() => calls.push('third'));
		const frame = { draw, state, viewport: state.viewport, memoryViews, blockPositions };
		drawCodeBlocks(frame, renderRegistry);
		expect(calls).toEqual(['first', 'second', 'third']);
		removeSecond();
		drawCodeBlocks(frame, renderRegistry);
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
		const viewport = { ...state.viewport };
		const blockPositions = createFrameBlockPositions().prepare(state.project.activeLevel.blocks, viewport);
		const draw = createDrawContext();
		const renderRegistry = createEditorRenderRegistry();
		const calls: string[] = [];
		renderRegistry.registerOffscreenCodeBlockDrawer((context, renderedBlock, presentedViewport) => {
			expect(context).toBe(draw);
			expect(presentedViewport).toBe(viewport);
			expect(renderedBlock).toBe(blockPositions.byCodeBlock.get(renderedBlock.codeBlock));
			calls.push(renderedBlock.codeBlock === offscreen ? 'offscreen' : 'last offscreen');
		});
		renderRegistry.registerCodeBlockDrawer(() => calls.push('visible'));
		const frame = { draw, state, viewport, memoryViews: createMemoryViews(), blockPositions };
		drawCodeBlocks(frame, renderRegistry);
		expect(calls).toEqual(['offscreen', 'visible', 'last offscreen']);
		expect(draw.startGroup).toHaveBeenCalledExactlyOnceWith(24 - viewport.x, 32 - viewport.y);
		expect(draw.endGroup).toHaveBeenCalledOnce();

		state.featureFlags.canvasOverlays = false;
		calls.length = 0;
		drawCodeBlocks(frame, renderRegistry);
		expect(calls).toEqual(['visible']);
	});

	it('uses presented positions and viewport for culling and local coordinates, independent of editor state', () => {
		const logicalOffscreen = createMockCodeBlock({ x: 3000, y: 20 });
		const logicalVisible = createMockCodeBlock({ x: 20, y: 30 });
		const state = createMockState({
			project: { activeLevel: { blocks: [logicalOffscreen, logicalVisible] } },
		});
		const viewport = { ...state.viewport, width: 64, height: 64 };
		const blocks = [
			{ codeBlock: logicalOffscreen, x: 5, y: 15 },
			{ codeBlock: logicalVisible, x: 128, y: 20 },
		];
		const blockPositions = { ordered: blocks, byCodeBlock: new Map(blocks.map(block => [block.codeBlock, block])) };
		const draw = createDrawContext();
		const memoryViews = createMemoryViews();
		const renderRegistry = createEditorRenderRegistry();
		const visible = vi.fn();
		const offscreen = vi.fn();
		renderRegistry.registerCodeBlockDrawer(visible);
		renderRegistry.registerOffscreenCodeBlockDrawer(offscreen);

		drawCodeBlocks({ draw, state, viewport, memoryViews, blockPositions }, renderRegistry);

		expect(draw.startGroup).toHaveBeenCalledExactlyOnceWith(5, 15);
		expect(visible).toHaveBeenCalledExactlyOnceWith({ draw, state, codeBlock: logicalOffscreen, memoryViews });
		expect(offscreen).toHaveBeenCalledExactlyOnceWith(draw, blocks[1], viewport);
		expect(logicalOffscreen.x).toBe(3000);
		expect(logicalVisible.x).toBe(20);
	});

	it('replaces the offscreen drawer and clears only the current registration on disposal', () => {
		const renderRegistry = createEditorRenderRegistry();
		const draw = createDrawContext();
		const viewport = createMockViewport();
		const codeBlock = createMockCodeBlock({ x: 10000 });
		const block = { codeBlock, x: 10000, y: 0 };
		const first = vi.fn();
		const second = vi.fn();
		renderRegistry.drawOffscreenCodeBlock(draw, block, viewport);
		const removeFirst = renderRegistry.registerOffscreenCodeBlockDrawer(first);
		const removeSecond = renderRegistry.registerOffscreenCodeBlockDrawer(second);
		removeFirst();
		renderRegistry.drawOffscreenCodeBlock(draw, block, viewport);
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledExactlyOnceWith(draw, block, viewport);
		removeSecond();
		renderRegistry.drawOffscreenCodeBlock(draw, block, viewport);
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledOnce();
	});

	it('does not restore an overwritten offscreen drawer', () => {
		const renderRegistry = createEditorRenderRegistry();
		const first = vi.fn();
		renderRegistry.registerOffscreenCodeBlockDrawer(first);
		const removeCurrent = renderRegistry.registerOffscreenCodeBlockDrawer(vi.fn());
		removeCurrent();
		renderRegistry.drawOffscreenCodeBlock(
			createDrawContext(),
			{ codeBlock: createMockCodeBlock(), x: 0, y: 0 },
			createMockViewport()
		);
		expect(first).not.toHaveBeenCalled();
	});

	it('only removes the current offscreen registration even when the same callback is registered again', () => {
		const renderRegistry = createEditorRenderRegistry();
		const callback = vi.fn();
		const draw = createDrawContext();
		const block = { codeBlock: createMockCodeBlock(), x: 0, y: 0 };
		const viewport = createMockViewport();
		const removePrevious = renderRegistry.registerOffscreenCodeBlockDrawer(callback);
		const removeCurrent = renderRegistry.registerOffscreenCodeBlockDrawer(callback);
		removePrevious();
		renderRegistry.drawOffscreenCodeBlock(draw, block, viewport);
		expect(callback).toHaveBeenCalledExactlyOnceWith(draw, block, viewport);
		removeCurrent();
		renderRegistry.drawOffscreenCodeBlock(draw, block, viewport);
		expect(callback).toHaveBeenCalledTimes(1);
	});
});
