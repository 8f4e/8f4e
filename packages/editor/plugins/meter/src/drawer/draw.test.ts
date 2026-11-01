import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { DrawContext as Engine, MemoryViews } from '@8f4e/web-ui';
import { describe, expect, it, vi } from 'vitest';
import { createDrawContextMock } from '../__tests__/rendering';
import type { Meter } from '../types';
import drawMeters from './draw';

function createMemoryViews({ float32 = [] }: { float32?: number[] } = {}): MemoryViews {
	return {
		int8: new Int8Array(0),
		int16: new Int16Array(0),
		int32: new Int32Array(0),
		uint8: new Uint8Array(0),
		uint16: new Uint16Array(0),
		float32: new Float32Array(float32),
		float64: new Float64Array(0),
	};
}

function createMockEngine(): Engine {
	return createDrawContextMock();
}

function createMeterWidget(overrides: Partial<Meter> = {}): Meter {
	return {
		x: 0,
		y: 0,
		width: 20,
		height: 6,
		minValue: 0,
		maxValue: 1,
		isBipolar: false,
		amplitudeLimit: 0,
		inverseValueRange: 1,
		greenEndX: 13,
		yellowEndX: 18,
		overloadMarkerX: 12,
		overloadMarkerWidth: 8,
		staticValueIndex: 0,
		memory: {
			showAddress: false,
			bufferPointer: 0,
			memory: {
				byteAddress: 0,
				allocationUnitAddress: 0,
				allocationUnitCount: 1,
			},
		} as never,
		baseSampleShift: 2,
		valueType: 'float32',
		...overrides,
	};
}

describe('drawMeters', () => {
	it('renders a segmented horizontal meter based on the current value', () => {
		const engine = createMockEngine();
		const values: Meter[] = [createMeterWidget({ x: 2, y: 3 })];

		drawMeters(engine, values, createMemoryViews({ float32: [0.95] }));

		const drawSprite = vi.mocked(engine.drawFill);
		expect(drawSprite).toHaveBeenCalledWith(0, 0, PALETTE_INDICES.darkSurface, 20, 6);
		expect(drawSprite).toHaveBeenCalledWith(0, 0, PALETTE_INDICES.positiveBase, 13, 6);
		expect(drawSprite).toHaveBeenCalledWith(13, 0, PALETTE_INDICES.warningBase, 5, 6);
		expect(drawSprite).toHaveBeenCalledWith(18, 0, PALETTE_INDICES.negativeBase, 1, 6);
	});

	it('clamps out-of-range values to a full meter', () => {
		const engine = createMockEngine();
		const values: Meter[] = [
			createMeterWidget({
				width: 10,
				height: 4,
				greenEndX: 6,
				yellowEndX: 9,
				overloadMarkerX: 2,
			}),
		];

		drawMeters(engine, values, createMemoryViews({ float32: [2] }));

		const drawSprite = vi.mocked(engine.drawFill);
		expect(drawSprite).toHaveBeenCalledWith(0, 0, PALETTE_INDICES.positiveBase, 6, 4);
		expect(drawSprite).toHaveBeenCalledWith(6, 0, PALETTE_INDICES.warningBase, 3, 4);
		expect(drawSprite).toHaveBeenCalledWith(9, 0, PALETTE_INDICES.negativeBase, 1, 4);
	});

	it('returns fully to zero when the bound scalar value is zero', () => {
		const engine = createMockEngine();
		const values: Meter[] = [
			createMeterWidget({
				width: 12,
				height: 4,
				greenEndX: 8,
				yellowEndX: 10,
				overloadMarkerX: 4,
			}),
		];

		drawMeters(engine, values, createMemoryViews({ float32: [0] }));

		const drawSprite = vi.mocked(engine.drawFill);
		expect(drawSprite).toHaveBeenCalledTimes(1);
		expect(drawSprite).toHaveBeenCalledWith(0, 0, PALETTE_INDICES.darkSurface, 12, 4);
	});

	it('treats bipolar ranges as amplitude meters so silence renders empty', () => {
		const engine = createMockEngine();
		const values: Meter[] = [
			createMeterWidget({
				width: 12,
				height: 4,
				minValue: -1,
				maxValue: 1,
				isBipolar: true,
				amplitudeLimit: 1,
				inverseValueRange: 0.5,
				greenEndX: 8,
				yellowEndX: 10,
				overloadMarkerX: 4,
			}),
		];

		drawMeters(engine, values, createMemoryViews({ float32: [0] }));

		const drawSprite = vi.mocked(engine.drawFill);
		expect(drawSprite).toHaveBeenCalledTimes(1);
		expect(drawSprite).toHaveBeenCalledWith(0, 0, PALETTE_INDICES.darkSurface, 12, 4);
	});

	it('fills negative bipolar values by magnitude', () => {
		const engine = createMockEngine();
		const values: Meter[] = [
			createMeterWidget({
				minValue: -1,
				maxValue: 1,
				isBipolar: true,
				amplitudeLimit: 1,
				inverseValueRange: 0.5,
			}),
		];

		drawMeters(engine, values, createMemoryViews({ float32: [-0.5] }));

		const drawSprite = vi.mocked(engine.drawFill);
		expect(drawSprite).toHaveBeenCalledWith(0, 0, PALETTE_INDICES.darkSurface, 20, 6);
		expect(drawSprite).toHaveBeenCalledWith(0, 0, PALETTE_INDICES.positiveBase, 10, 6);
	});

	it('latches a red overload marker at the end of the meter after clipping', () => {
		const engine = createMockEngine();
		const values: Meter[] = [
			createMeterWidget({
				width: 12,
				height: 4,
				greenEndX: 8,
				yellowEndX: 10,
				overloadMarkerX: 4,
			}),
		];
		const drawSprite = vi.mocked(engine.drawFill);

		drawMeters(engine, values, createMemoryViews({ float32: [1.2] }));
		expect(drawSprite).toHaveBeenCalledWith(4, 0, PALETTE_INDICES.negativeBase, 8, 4);

		drawSprite.mockClear();
		drawMeters(engine, values, createMemoryViews({ float32: [0.4] }));
		expect(drawSprite).toHaveBeenCalledWith(4, 0, PALETTE_INDICES.negativeBase, 8, 4);
	});
});
