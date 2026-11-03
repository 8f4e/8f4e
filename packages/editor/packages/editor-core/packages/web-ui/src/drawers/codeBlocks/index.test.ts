import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import type { DrawContext as Engine } from '../../drawContext';
import type { MemoryViews } from '../../types';
import { createEditorDrawerRegistry } from '../registry';
import drawModules from './index';

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
		const unregisterBackground = drawers.registerCodeBlockBackgroundDrawer(context => {
			expect(context).toEqual({ draw: engine, state, codeBlock: visible, memoryViews });
			expect(engine.startGroup).toHaveBeenLastCalledWith(visible.x, visible.y);
			calls.push('background');
		});
		drawers.registerCodeBlockBackgroundDrawer(() => calls.push('second background'));
		const unregisterContent = drawers.registerCodeBlockContentDrawer(context => {
			expect(context).toEqual({ draw: engine, state, codeBlock: visible, memoryViews });
			expect(engine.startGroup).toHaveBeenLastCalledWith(visible.x, visible.y);
			calls.push('content');
		});
		const unregisterForeground = drawers.registerCodeBlockForegroundDrawer(context => {
			expect(context).toEqual({ draw: engine, state, codeBlock: visible, memoryViews });
			calls.push('foreground');
		});
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
		drawModules(engine, state, memoryViews, drawers);
		expect(calls).toEqual(['background', 'second background', 'content', 'foreground', 'first', 'second', 'overlay']);
		unregisterBackground();
		unregisterContent();
		unregisterForeground();
		unregister();
		unregisterOverlay();
		drawModules(engine, state, memoryViews, drawers);
		expect(calls).toEqual([
			'background',
			'second background',
			'content',
			'foreground',
			'first',
			'second',
			'overlay',
			'second background',
			'second',
		]);
		expect(first).toHaveBeenCalledOnce();
	});

	it('draws plugin backgrounds below selection and content, and foreground drawings below diagnostics', () => {
		const block = createMockCodeBlock({
			width: 96,
			height: 64,
			widgets: {
				shapeDeclarations: [],
				errorMessages: [{ x: 8, y: 32, message: ['Diagnostic'] }],
			},
		});
		const state = createMockState({
			editorMode: 'edit',
			codeBlockRendering: { currentProject: { entries: [], path: '', blocks: [block] }, selectedCodeBlock: block },
		});
		const engine = createMockEngine();
		const drawers = createEditorDrawerRegistry();
		const background = vi.fn(() => engine.drawFill(24, 16, PALETTE_INDICES.surfaceRaised1, 72, 16));
		drawers.registerCodeBlockBackgroundDrawer(background);
		const content = vi.fn(() => engine.drawText(8, 0, 'Content', PALETTE_INDICES.inkBase));
		drawers.registerCodeBlockContentDrawer(content);
		drawers.registerCodeBlockForegroundDrawer(() => engine.drawText(8, 0, 'Foreground', PALETTE_INDICES.inkBase));
		drawModules(engine, state, createMemoryViews(), drawers);
		const text = vi.mocked(engine.drawText).mock.calls.map(([, , text]) => text);
		expect(text.indexOf('Content')).toBeLessThan(text.indexOf('Foreground'));
		expect(text.indexOf('Foreground')).toBeLessThan(text.findIndex(text => text.includes('Diagnostic')));
		const fills = vi.mocked(engine.drawFill).mock.invocationCallOrder;
		expect(fills[0]).toBeLessThan(background.mock.invocationCallOrder[0]);
		expect(fills[1]).toBeLessThan(fills[2]);
		expect(fills[2]).toBeLessThan(content.mock.invocationCallOrder[0]);
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

		drawModules(engine, state, createMemoryViews());

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

		drawModules(engine, state, createMemoryViews());

		expect((engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText).not.toHaveBeenCalled();
	});
});
