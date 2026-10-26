import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockSpriteLookups, createMockState } from '@8f4e/editor-state-testing';
import type { ArrayBars } from '@8f4e/editor-state-types';
import { describe, expect, it, vi } from 'vitest';
import { createDrawContextMock } from '../../../__tests__/rendering';
import type { DrawContext as Engine } from '../../../drawContext';
import type { MemoryViews } from '../../../types';
import drawBars from './bars';

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

function createBarsWidget(overrides: Partial<ArrayBars> = {}): ArrayBars {
	return {
		x: 0,
		y: 0,
		width: 8,
		height: 8,
		minValue: 0,
		maxValue: 1,
		inverseValueRange: 1,
		staticBaseValueIndex: 0,
		staticColumnLayout: [
			{ x: 0, width: 2, sliceStart: 0, sliceEnd: 1 },
			{ x: 2, width: 2, sliceStart: 1, sliceEnd: 2 },
			{ x: 4, width: 2, sliceStart: 2, sliceEnd: 3 },
			{ x: 6, width: 2, sliceStart: 3, sliceEnd: 4 },
		],
		startAddress: {
			showAddress: true,
			showEndAddress: false,
			bufferPointer: 0,
			displayFormat: 'decimal',
			memory: { byteAddress: 0, allocationUnitAddress: 0, allocationUnitCount: 4 },
		} as never,
		baseSampleShift: 2,
		length: 4,
		valueType: 'float32',
		...overrides,
	};
}

describe('drawBars', () => {
	it('renders buffer values as vertical bars', () => {
		const engine = createMockEngine();
		const state = createMockState({
			spriteLookups: createMockSpriteLookups() as never,
		});
		const codeBlock = createMockCodeBlock({
			widgets: {
				arrayBars: [createBarsWidget()],
			} as never,
		});

		drawBars(engine, state, codeBlock, createMemoryViews({ float32: [0.25, 0.5, 0.75, 1] }));

		const drawSprite = vi.mocked(engine.drawFill);
		expect(drawSprite).toHaveBeenCalledWith(0, 0, PALETTE_INDICES.darkSurface, 8, 8);
		expect(drawSprite).toHaveBeenCalledWith(0, 6, PALETTE_INDICES.detailBase, 2, 2);
		expect(drawSprite).toHaveBeenCalledWith(2, 4, PALETTE_INDICES.detailBase, 2, 4);
		expect(drawSprite).toHaveBeenCalledWith(4, 2, PALETTE_INDICES.detailBase, 2, 6);
		expect(drawSprite).toHaveBeenCalledWith(6, 0, PALETTE_INDICES.detailBase, 2, 8);
	});

	it('compresses dense arrays by the maximum value in each column', () => {
		const engine = createMockEngine();
		const state = createMockState({
			spriteLookups: createMockSpriteLookups() as never,
		});
		const codeBlock = createMockCodeBlock({
			widgets: {
				arrayBars: [
					createBarsWidget({
						width: 4,
						staticColumnLayout: [
							{ x: 0, width: 1, sliceStart: 0, sliceEnd: 2 },
							{ x: 1, width: 1, sliceStart: 2, sliceEnd: 4 },
							{ x: 2, width: 1, sliceStart: 4, sliceEnd: 6 },
							{ x: 3, width: 1, sliceStart: 6, sliceEnd: 8 },
						],
						length: 8,
					}),
				],
			} as never,
		});

		drawBars(engine, state, codeBlock, createMemoryViews({ float32: [0, 0.25, 0.1, 0.5, 0.2, 0.75, 0.3, 1] }));

		const drawSprite = vi.mocked(engine.drawFill);
		expect(drawSprite).toHaveBeenCalledWith(0, 6, PALETTE_INDICES.detailBase, 1, 2);
		expect(drawSprite).toHaveBeenCalledWith(1, 4, PALETTE_INDICES.detailBase, 1, 4);
		expect(drawSprite).toHaveBeenCalledWith(2, 2, PALETTE_INDICES.detailBase, 1, 6);
		expect(drawSprite).toHaveBeenCalledWith(3, 0, PALETTE_INDICES.detailBase, 1, 8);
	});
});
