import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { WebUiRenderData } from '@8f4e/web-ui-render-projection';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DrawContext as Engine } from '../../drawContext';
import type { MemoryViews } from '../../types';
import { createEditorDrawerRegistry } from '../registry';
import drawModules from './index';

const emptyRenderData: WebUiRenderData = { codeBlocks: new Map() };

function createMemoryViews({ int32 = [] }: { int32?: number[] } = {}): MemoryViews {
	return {
		int8: new Int8Array(0),
		int16: new Int16Array(0),
		int32: new Int32Array(int32),
		uint8: new Uint8Array(0),
		uint16: new Uint16Array(0),
		float32: new Float32Array(0),
		float64: new Float64Array(0),
	};
}

function createMockEngine(): Engine {
	return {
		startGroup: vi.fn(),
		endGroup: vi.fn(),
		drawSprite: vi.fn(),
		drawFill: vi.fn(),
		drawCharacter: vi.fn(),
		drawText: vi.fn(),
		drawResolvedText: vi.fn(),
	} as unknown as Engine;
}

describe('drawModules', () => {
	it('runs plugin drawers inside each visible block group in registration order', () => {
		const visible = createMockCodeBlock({ width: 96, height: 64, x: 16, y: 16 });
		const offscreen = createMockCodeBlock({ creationIndex: 1, x: 10000 });
		const state = createMockState({
			codeBlockRendering: { currentProject: { entries: [], path: '', blocks: [visible, offscreen] } },
		});
		const engine = createMockEngine();
		const memoryViews = createMemoryViews();
		const drawers = createEditorDrawerRegistry();
		const calls: string[] = [];
		const first = vi.fn(context => {
			expect(context).toEqual({ draw: engine, state, codeBlock: visible, memoryViews });
			expect(engine.startGroup).toHaveBeenLastCalledWith(visible.x, visible.y);
			calls.push('first');
		});
		const unregister = drawers.registerCodeBlockDrawer(first);
		drawers.registerCodeBlockDrawer(() => calls.push('second'));
		const unregisterOverlay = drawers.registerCodeBlockOverlay(context => {
			expect(context.codeBlock).toBe(visible);
			expect(engine.startGroup).toHaveBeenLastCalledWith(visible.x, visible.y);
			calls.push('overlay');
		});
		drawModules(engine, state, memoryViews, emptyRenderData, drawers);
		expect(calls).toEqual(['first', 'second', 'overlay']);
		unregister();
		unregisterOverlay();
		drawModules(engine, state, memoryViews, emptyRenderData, drawers);
		expect(calls).toEqual(['first', 'second', 'overlay', 'second']);
		expect(first).toHaveBeenCalledOnce();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it.each(['view', 'edit'] as const)('draws an animated outline only for the selected block in %s mode', editorMode => {
		const selectedBlock = createMockCodeBlock({ creationIndex: 0, width: 96, height: 64 });
		const otherBlock = createMockCodeBlock({ creationIndex: 1, x: 160, width: 96, height: 64 });
		const state = createMockState({
			editorMode,
			codeBlockRendering: {
				currentProject: { entries: [], path: '', blocks: [selectedBlock, otherBlock] },
				selectedCodeBlock: selectedBlock,
			},
		});
		const engine = createMockEngine();
		const now = vi.spyOn(performance, 'now').mockReturnValue(0);
		const outlineCalls = () => vi.mocked(engine.drawText).mock.calls.filter(call => call[2] !== '+' && call[2] !== '_');

		drawModules(engine, state, createMemoryViews(), emptyRenderData);
		const initialOutline = outlineCalls();
		expect(initialOutline).toHaveLength(4);

		vi.mocked(engine.drawText).mockClear();
		now.mockReturnValue(80);
		drawModules(engine, state, createMemoryViews(), emptyRenderData);
		expect(outlineCalls()).toHaveLength(4);
		expect(outlineCalls()).not.toEqual(initialOutline);

		vi.mocked(engine.drawText).mockClear();
		state.codeBlockRendering.selectedCodeBlock = otherBlock;
		drawModules(engine, state, createMemoryViews(), emptyRenderData);
		expect(outlineCalls()).toHaveLength(4);

		vi.mocked(engine.drawText).mockClear();
		state.codeBlockRendering.selectedCodeBlock = undefined;
		drawModules(engine, state, createMemoryViews(), emptyRenderData);
		expect(outlineCalls()).toHaveLength(0);
	});

	it('draws resolved code cells from projected render data', () => {
		const block = createMockCodeBlock({ creationIndex: 4, width: 100, height: 50 });
		const state = createMockState({
			codeBlockRendering: { currentProject: { entries: [], path: '', blocks: [block] } },
		});
		const engine = createMockEngine();
		const codeCells = [[1, null, 2]] as never;

		drawModules(engine, state, createMemoryViews(), {
			codeBlocks: new Map([[block.creationIndex, { codeCells }]]),
		});

		expect((engine as unknown as { drawResolvedText: ReturnType<typeof vi.fn> }).drawResolvedText).toHaveBeenCalledWith(
			state.viewport.vGrid,
			0,
			codeCells[0]
		);
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
		const engine = createMockEngine();

		drawModules(engine, state, createMemoryViews(), emptyRenderData);

		expect(vi.mocked(engine.drawFill)).toHaveBeenNthCalledWith(1, 8, 16, PALETTE_INDICES.strokeBase, 96, 1);
		expect(vi.mocked(engine.drawFill)).toHaveBeenNthCalledWith(2, 8, 95, PALETTE_INDICES.strokeBase, 96, 1);
		expect(vi.mocked(engine.drawFill)).toHaveBeenNthCalledWith(3, 8, 16, PALETTE_INDICES.strokeBase, 1, 80);
		expect(vi.mocked(engine.drawFill)).toHaveBeenNthCalledWith(4, 103, 16, PALETTE_INDICES.strokeBase, 1, 80);
		expect((engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText).toHaveBeenCalledWith(
			16,
			16,
			'main',
			PALETTE_INDICES.inkStrong
		);
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
		const engine = createMockEngine();

		drawModules(engine, state, createMemoryViews(), emptyRenderData);

		expect((engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText).not.toHaveBeenCalled();
	});
});
