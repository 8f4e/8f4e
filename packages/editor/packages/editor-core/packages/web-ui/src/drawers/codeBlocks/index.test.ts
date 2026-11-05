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
	} as unknown as DrawContext;
}

describe('drawCodeBlocks', () => {
	it('runs the ordered registry once inside each visible block and removes only the requested drawer', () => {
		const visible = createMockCodeBlock({ width: 96, height: 64, x: 16, y: 16 });
		const offscreen = createMockCodeBlock({ creationIndex: 1, x: 10000 });
		const state = createMockState({
			codeBlockRendering: { currentProject: { entries: [], path: '', blocks: [visible, offscreen] } },
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

	it('calls visible and offscreen drawers in the same block traversal', () => {
		const offscreen = createMockCodeBlock({ x: 1200 });
		const visible = createMockCodeBlock({ creationIndex: 1, x: 24, y: 32 });
		const state = createMockState({
			codeBlockRendering: {
				currentProject: { entries: [], path: '', blocks: [offscreen, visible, offscreen] },
			},
		});
		const draw = createDrawContext();
		const drawers = createEditorDrawerRegistry();
		const calls: string[] = [];
		drawers.registerOffscreenCodeBlockDrawer((context, codeBlock, currentState) => {
			expect([context, codeBlock, currentState]).toEqual([draw, offscreen, state]);
			calls.push('offscreen');
		});
		drawers.registerCodeBlockDrawer(() => calls.push('visible'));
		drawCodeBlocks(draw, state, createMemoryViews(), drawers);
		expect(calls).toEqual(['offscreen', 'visible', 'offscreen']);
		expect(draw.startGroup).toHaveBeenNthCalledWith(1, -state.viewport.x, -state.viewport.y);
		expect(draw.startGroup).toHaveBeenCalledTimes(2);

		state.featureFlags.canvasOverlays = false;
		calls.length = 0;
		drawCodeBlocks(draw, state, createMemoryViews(), drawers);
		expect(calls).toEqual(['visible']);
	});

	it('replaces the offscreen drawer and clears only the current registration on disposal', () => {
		const drawers = createEditorDrawerRegistry();
		const draw = createDrawContext();
		const state = createMockState();
		const block = createMockCodeBlock({ x: 10000 });
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
		drawers.drawOffscreenCodeBlock(createDrawContext(), createMockCodeBlock(), createMockState());
		expect(first).not.toHaveBeenCalled();
	});
});
