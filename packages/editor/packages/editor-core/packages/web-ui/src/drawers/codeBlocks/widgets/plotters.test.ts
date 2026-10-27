import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import { createDrawContextMock } from '../../../__tests__/rendering';
import type { DrawContext as Engine } from '../../../drawContext';
import type { MemoryViews } from '../../../types';
import drawPlotters from './plotters';

function createMemoryViews({ int8 = [], int32 = [] }: { int8?: number[]; int32?: number[] } = {}): MemoryViews {
	return {
		int8: new Int8Array(int8),
		int16: new Int16Array(0),
		int32: new Int32Array(int32),
		uint8: new Uint8Array(0),
		uint16: new Uint16Array(0),
		float32: new Float32Array(0),
		float64: new Float64Array(0),
	};
}

function createMockEngine(): Engine {
	return createDrawContextMock();
}

describe('drawPlotters', () => {
	it('renders one sample per point for short arrays', () => {
		const engine = createMockEngine();
		const state = createMockState({
			viewport: {
				hGrid: 4,
				vGrid: 8,
			},
		});
		const codeBlock = createMockCodeBlock({
			width: 20,
			widgets: {
				arrayPlotters: [
					{
						x: 0,
						y: 0,
						startAddress: {
							showAddress: true,
							bufferPointer: 0,
							memory: { byteAddress: 0, allocationUnitAddress: 0, allocationUnitCount: 4 },
						},
						baseSampleShift: 0,
						length: 4,
						valueType: 'int8',
						minValue: 0,
						maxValue: 3,
						width: 0,
						height: 0,
					},
				],
			} as never,
		});

		drawPlotters(engine, state, codeBlock, createMemoryViews({ int8: [0, 1, 2, 3] }));

		const drawSprite = vi.mocked(engine.drawFill);
		expect(drawSprite).toHaveBeenCalledWith(0, 0, PALETTE_INDICES.darkSurface, 12, 32);
		expect(drawSprite).toHaveBeenCalledWith(0, 31, PALETTE_INDICES.onDarkAccent, 3, 1);
		expect(drawSprite).toHaveBeenCalledWith(3, 21, PALETTE_INDICES.onDarkAccent, 3, 1);
		expect(drawSprite).toHaveBeenCalledWith(6, 10, PALETTE_INDICES.onDarkAccent, 3, 1);
		expect(drawSprite).toHaveBeenCalledWith(9, 0, PALETTE_INDICES.onDarkAccent, 3, 1);
	});

	it('matches sparse background width to the rendered trace width', () => {
		const engine = createMockEngine();
		const state = createMockState({
			viewport: {
				hGrid: 4,
				vGrid: 8,
			},
		});
		const codeBlock = createMockCodeBlock({
			width: 21,
			widgets: {
				arrayPlotters: [
					{
						x: 0,
						y: 0,
						startAddress: {
							showAddress: true,
							bufferPointer: 0,
							memory: { byteAddress: 0, allocationUnitAddress: 0, allocationUnitCount: 4 },
						},
						baseSampleShift: 0,
						length: 4,
						valueType: 'int8',
						minValue: 0,
						maxValue: 3,
						width: 0,
						height: 0,
					},
				],
			} as never,
		});

		drawPlotters(engine, state, codeBlock, createMemoryViews({ int8: [0, 1, 2, 3] }));

		const drawSprite = vi.mocked(engine.drawFill);
		expect(drawSprite).toHaveBeenCalledWith(0, 0, PALETTE_INDICES.darkSurface, 12, 32);
		expect(drawSprite).toHaveBeenCalledWith(9, 0, PALETTE_INDICES.onDarkAccent, 3, 1);
	});

	it('renders dense arrays as per-column min/max envelopes instead of truncating', () => {
		const engine = createMockEngine();
		const state = createMockState({
			viewport: {
				hGrid: 4,
				vGrid: 8,
			},
		});
		const codeBlock = createMockCodeBlock({
			width: 20,
			widgets: {
				arrayPlotters: [
					{
						x: 0,
						y: 0,
						startAddress: {
							showAddress: true,
							bufferPointer: 0,
							memory: { byteAddress: 0, allocationUnitAddress: 0, allocationUnitCount: 24 },
						},
						baseSampleShift: 0,
						length: 24,
						valueType: 'int8',
						minValue: 0,
						maxValue: 10,
						width: 0,
						height: 0,
					},
				],
			} as never,
		});

		const values = Array.from({ length: 24 }, (_, index) => (index % 2 === 0 ? 0 : 10));
		drawPlotters(engine, state, codeBlock, createMemoryViews({ int8: values }));

		const drawSprite = vi.mocked(engine.drawFill);
		const traceCalls = drawSprite.mock.calls.filter((call: unknown[]) => call[2] === PALETTE_INDICES.onDarkAccent);

		expect(traceCalls).toHaveLength(12);
		expect(traceCalls[0]).toEqual([0, 0, PALETTE_INDICES.onDarkAccent, 1, 32]);
		expect(traceCalls[11]).toEqual([11, 0, PALETTE_INDICES.onDarkAccent, 1, 32]);
	});
});
