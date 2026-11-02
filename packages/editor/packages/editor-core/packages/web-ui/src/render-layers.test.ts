import { resolvePalette } from '@8f4e/editor-palette';
import { createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import { createRenderLayerRegistry } from './render-layers';
import type { MemoryViews } from './types';

const context = { gl: {} as WebGL2RenderingContext, palette: resolvePalette({}) };
const frame = { state: createMockState(), memoryViews: {} as MemoryViews };
const createLayer = () => ({ draw: vi.fn(), loadPalette: vi.fn(), releaseMemory: vi.fn(), destroy: vi.fn() });

describe('render layer lifecycle', () => {
	it('defers allocation until attachment and supports removing a pending registration', () => {
		const registry = createRenderLayerRegistry();
		const factory = vi.fn(createLayer);
		const unregister = registry.registerRenderLayer(factory);
		expect(factory).not.toHaveBeenCalled();
		unregister();
		registry.attachRenderLayers(context).draw(frame);
		expect(factory).not.toHaveBeenCalled();
	});

	it('draws in registration order and disposes an unregistered layer exactly once', () => {
		const registry = createRenderLayerRegistry();
		const first = createLayer();
		const second = createLayer();
		const unregister = registry.registerRenderLayer(() => first);
		const binding = registry.attachRenderLayers(context);
		const lateFactory = vi.fn(() => second);
		registry.registerRenderLayer(lateFactory);
		binding.draw(frame);
		expect(lateFactory).toHaveBeenCalledWith(context);
		expect(first.draw).toHaveBeenCalledWith(frame);
		expect(first.draw.mock.invocationCallOrder[0]).toBeLessThan(second.draw.mock.invocationCallOrder[0]);
		unregister();
		unregister();
		binding.draw(frame);
		binding.destroy();
		binding.destroy();
		expect(first.draw).toHaveBeenCalledOnce();
		expect(first.destroy).toHaveBeenCalledOnce();
		expect(second.destroy).toHaveBeenCalledOnce();
	});

	it('delivers the current palette and suspended memory state to late registrations', () => {
		const registry = createRenderLayerRegistry();
		const first = createLayer();
		registry.registerRenderLayer(() => first);
		const binding = registry.attachRenderLayers(context);
		const palette = resolvePalette({ primary: '#ff0000' });
		binding.loadPalette(palette);
		binding.releaseMemory();
		binding.releaseMemory();
		const second = createLayer();
		const factory = vi.fn(() => second);
		registry.registerRenderLayer(factory);
		expect(first.loadPalette).toHaveBeenCalledWith(palette);
		expect(factory).toHaveBeenCalledWith({ gl: context.gl, palette });
		expect(first.releaseMemory).toHaveBeenCalledOnce();
		expect(second.releaseMemory).toHaveBeenCalledOnce();
		binding.draw(frame);
		binding.releaseMemory();
		expect(first.releaseMemory).toHaveBeenCalledTimes(2);
		expect(second.releaseMemory).toHaveBeenCalledTimes(2);
		binding.destroy();
	});

	it('cleans up successful factories when a later factory fails', () => {
		const registry = createRenderLayerRegistry();
		const layer = createLayer();
		registry.registerRenderLayer(() => layer);
		registry.registerRenderLayer(() => {
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
		registry.registerRenderLayer(() => first);
		registry.registerRenderLayer(() => second);
		const binding = registry.attachRenderLayers(context);
		expect(() => binding.destroy()).toThrow(AggregateError);
		expect(first.destroy).toHaveBeenCalledOnce();
		expect(second.destroy).toHaveBeenCalledOnce();
		expect(() => binding.destroy()).not.toThrow();
	});
});
