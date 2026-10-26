import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockSpriteLookups, createMockState } from '@8f4e/editor-state-testing';
import type { MemoryViews } from '@8f4e/web-ui';
import { describe, expect, it, vi } from 'vitest';
import { createDrawContextMock } from '../__tests__/rendering';
import type { Slider } from '../types';
import { drawSliders } from './draw';

const slider: Slider = {
	moduleId: 'test',
	x: 10,
	y: 20,
	width: 32,
	height: 32,
	id: 'gain',
	allocationUnitAddress: 0,
	byteAddress: 0,
	isInteger: false,
	isFloat64: false,
	min: 0,
	max: 1,
};

function createMemoryViews(value: number): MemoryViews {
	return {
		int8: new Int8Array(0),
		int16: new Int16Array(0),
		int32: new Int32Array(0),
		uint8: new Uint8Array(0),
		uint16: new Uint16Array(0),
		float32: new Float32Array([value]),
		float64: new Float64Array(0),
	};
}

describe('drawSliders', () => {
	it('draws a vertical bar on each row of the slider handle', () => {
		const engine = createDrawContextMock();
		const state = createMockState({
			viewport: { vGrid: 8, hGrid: 16 },
			spriteLookups: createMockSpriteLookups() as never,
		});

		drawSliders(engine, state, [slider], createMemoryViews(0.5));

		const drawSprite = vi.mocked(engine.drawFill);
		const drawText = vi.mocked(engine.drawText);
		expect(drawSprite.mock.calls).toEqual([
			[0, 0, PALETTE_INDICES.surfaceRaised2, 32, 32],
			[0, 0, PALETTE_INDICES.primaryDark2, 20, 32],
			[12, 0, PALETTE_INDICES.inkBase, 8, 32],
		]);
		expect(drawText.mock.calls).toEqual([
			[12, 0, '|', PALETTE_INDICES.inkOn],
			[12, 16, '|', PALETTE_INDICES.inkOn],
		]);
	});
});
