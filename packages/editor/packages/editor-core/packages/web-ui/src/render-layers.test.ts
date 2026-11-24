import { resolvePalette } from '@8f4e/editor-palette';
import { createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import { createRenderGeometry } from './render-geometry';
import { createRenderLayerRegistry, type RenderLayerContext, type RenderLayerFont } from './render-layers';
import type { MemoryViews } from './types';

const context: RenderLayerContext = {
	gl: {} as WebGL2RenderingContext,
	palette: resolvePalette({}),
	font: { name: 'ibmvga8x16', grid: { cellWidth: 8, cellHeight: 16, columns: 16, cellCount: 257 } },
};
const state = createMockState();
const frame = {
	state,
	viewport: state.viewport,
	memoryViews: {} as MemoryViews,
	renderGeometry: createRenderGeometry().prepare(state),
};
const createLayer = () => ({
	draw: vi.fn(),
	loadPalette: vi.fn(),
	loadFont: vi.fn(),
	releaseMemory: vi.fn(),
	destroy: vi.fn(),
});

describe('render layer lifecycle', () => {
	it('defers allocation until attachment and supports removing a pending registration', () => {
		const registry = createRenderLayerRegistry();
		const factory = vi.fn(createLayer);
		const unregister = registry.registerRenderLayer('beforeSprites', factory);
		expect(factory).not.toHaveBeenCalled();
		unregister();
		registry.attachRenderLayers(context).draw('beforeSprites', frame);
		expect(factory).not.toHaveBeenCalled();
	});

	it('draws in registration order and disposes an unregistered layer exactly once', () => {
		const registry = createRenderLayerRegistry();
		const first = createLayer();
		const second = createLayer();
		const unregister = registry.registerRenderLayer('afterSprites', () => first);
		const binding = registry.attachRenderLayers(context);
		const lateFactory = vi.fn(() => second);
		registry.registerRenderLayer('afterSprites', lateFactory);
		binding.draw('afterSprites', frame);
		expect(lateFactory).toHaveBeenCalledWith(context);
		expect(first.draw).toHaveBeenCalledWith(frame);
		expect(first.draw.mock.invocationCallOrder[0]).toBeLessThan(second.draw.mock.invocationCallOrder[0]);
		unregister();
		unregister();
		binding.draw('afterSprites', frame);
		binding.destroy();
		binding.destroy();
		expect(first.draw).toHaveBeenCalledOnce();
		expect(first.destroy).toHaveBeenCalledOnce();
		expect(second.destroy).toHaveBeenCalledOnce();
	});

	it('draws only layers of the requested stage, in their registration order', () => {
		const registry = createRenderLayerRegistry();
		const before = createLayer();
		const after = createLayer();
		const top = createLayer();
		registry.registerRenderLayer('afterSprites', () => after);
		registry.registerRenderLayer('beforeSprites', () => before);
		registry.registerRenderLayer('afterSprites', () => top);
		const binding = registry.attachRenderLayers(context);
		binding.draw('beforeSprites', frame);
		expect(before.draw).toHaveBeenCalledExactlyOnceWith(frame);
		expect(after.draw).not.toHaveBeenCalled();
		expect(top.draw).not.toHaveBeenCalled();
		binding.draw('afterSprites', frame);
		expect(before.draw).toHaveBeenCalledOnce();
		expect(after.draw).toHaveBeenCalledExactlyOnceWith(frame);
		expect(top.draw).toHaveBeenCalledExactlyOnceWith(frame);
		expect(after.draw.mock.invocationCallOrder[0]).toBeLessThan(top.draw.mock.invocationCallOrder[0]);
		binding.destroy();
	});

	it('delivers the current font, palette and suspended memory state to late registrations', () => {
		const registry = createRenderLayerRegistry();
		const first = createLayer();
		registry.registerRenderLayer('beforeSprites', () => first);
		const binding = registry.attachRenderLayers(context);
		const palette = resolvePalette({ primary: '#ff0000' });
		const font: RenderLayerFont = {
			name: 'spleen5x8',
			grid: { cellWidth: 5, cellHeight: 8, columns: 16, cellCount: 257 },
		};
		binding.loadPalette(palette);
		binding.loadFont(font);
		binding.releaseMemory();
		binding.releaseMemory();
		const second = createLayer();
		const factory = vi.fn(() => second);
		registry.registerRenderLayer('afterSprites', factory);
		expect(first.loadPalette).toHaveBeenCalledWith(palette);
		expect(first.loadFont).toHaveBeenCalledWith(font);
		expect(factory).toHaveBeenCalledWith({ gl: context.gl, palette, font });
		expect(first.releaseMemory).toHaveBeenCalledOnce();
		expect(second.releaseMemory).toHaveBeenCalledOnce();
		binding.draw('beforeSprites', frame);
		binding.draw('afterSprites', frame);
		binding.releaseMemory();
		expect(first.releaseMemory).toHaveBeenCalledTimes(2);
		expect(second.releaseMemory).toHaveBeenCalledTimes(2);
		binding.destroy();
	});

	it('cleans up successful factories when a later factory fails', () => {
		const registry = createRenderLayerRegistry();
		const layer = createLayer();
		registry.registerRenderLayer('beforeSprites', () => layer);
		registry.registerRenderLayer('afterSprites', () => {
			throw new Error('initialization failed');
		});
		expect(() => registry.attachRenderLayers(context)).toThrow('initialization failed');
		expect(layer.destroy).toHaveBeenCalledOnce();
	});

	it('destroys every layer before reporting a cleanup failure', () => {
		const registry = createRenderLayerRegistry();
		const first = createLayer();
		const second = createLayer();
		second.destroy.mockImplementation(() => {
			throw new Error('cleanup failed');
		});
		registry.registerRenderLayer('beforeSprites', () => first);
		registry.registerRenderLayer('afterSprites', () => second);
		const binding = registry.attachRenderLayers(context);
		expect(() => binding.destroy()).toThrow(AggregateError);
		expect(first.destroy).toHaveBeenCalledOnce();
		expect(second.destroy).toHaveBeenCalledOnce();
		expect(() => binding.destroy()).not.toThrow();
	});
});
