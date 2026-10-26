import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockSpriteLookups, createMockState } from '@8f4e/editor-state-testing';
import type { MemoryViews } from '@8f4e/web-ui';
import { describe, expect, it } from 'vitest';
import { createDrawContextMock } from '../__tests__/rendering';
import type { Wave } from '../types';
import drawWaves from './draw';

function memoryViews(): MemoryViews {
	const buffer = new ArrayBuffer(64);
	return {
		int8: new Int8Array(buffer),
		uint8: new Uint8Array(buffer),
		int16: new Int16Array(buffer),
		uint16: new Uint16Array(buffer),
		int32: new Int32Array(buffer),
		float32: new Float32Array(buffer),
		float64: new Float64Array(buffer),
	};
}
function wave(): Wave {
	return {
		x: 2,
		y: 3,
		width: 8,
		height: 8,
		source: { showAddress: true, bufferPointer: 0, memory: { byteAddress: 0, allocationUnitAddress: 0 } } as never,
		elementCount: 4,
		inverseElementByteSize: 1,
		baseSampleShift: 0,
		valueType: 'int8',
		minValue: -128,
		maxValue: 127,
		inverseValueRange: 1 / 255,
	};
}
function state() {
	return createMockState({
		spriteLookups: createMockSpriteLookups() as never,
		viewport: { vGrid: 4 },
	});
}

describe('wave drawing', () => {
	it('draws the background before the waveform and retains extrema in each column', () => {
		const draw = createDrawContextMock();
		const memory = memoryViews();
		memory.int8.set([-128, 0, 127, 0]);
		drawWaves(draw, state(), [wave()], memory);
		expect(draw.startGroup).toHaveBeenCalledWith(2, 3);
		expect(draw.drawFill).toHaveBeenNthCalledWith(1, 0, 0, PALETTE_INDICES.darkSurface, 8, 8);
		expect(draw.drawFill).toHaveBeenNthCalledWith(2, 0, 7, PALETTE_INDICES.highlightBase, 2, 1);
		expect(draw.drawFill).toHaveBeenNthCalledWith(4, 4, 0, PALETTE_INDICES.highlightBase, 2, 1);
	});
	it('draws an absolute playhead over the waveform', () => {
		const draw = createDrawContextMock();
		const memory = memoryViews();
		const data = wave();
		memory.int8.set([-128, 0, 127, 0]);
		memory.int32[4] = 2;
		data.playhead = { showAddress: false, bufferPointer: 0, memory: { allocationUnitAddress: 4 } } as never;
		drawWaves(draw, state(), [data], memory);
		expect(draw.drawFill).toHaveBeenLastCalledWith(4, 0, PALETTE_INDICES.secondaryReadable, 2, 8);
	});
	it('skips a waveform while its live element count is zero', () => {
		const draw = createDrawContextMock();
		const data = wave();
		data.elementCount = { memory: { allocationUnitAddress: 4 }, bufferPointer: 0 } as never;
		drawWaves(draw, state(), [data], memoryViews());
		expect(draw.drawFill).not.toHaveBeenCalled();
		expect(draw.endGroup).toHaveBeenCalledOnce();
	});
});
