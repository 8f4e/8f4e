import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { DrawContext } from '@8f4e/web-ui';
import { describe, expect, it, vi } from 'vitest';
import type { ConnectorWidgets, Output } from '../types';
import drawConnectors from './connectors';

function fixture(width = 8, height = 16) {
	const drawSprite = vi.fn();

	const state = createMockState({
		viewport: { vGrid: width, hGrid: height },
	});
	const engine = new DrawContext({ drawSprite }, width);
	const block = createMockCodeBlock();
	const output: Output = {
		codeBlock: block,
		x: 2,
		y: 3,
		width: width * 3,
		height,
		wireX: 0,
		wireY: 0,
		id: 'output',
		calibratedMax: 1,
		calibratedMin: -1,
		memory: {
			id: 'value',
			type: 'float',
			numberOfElements: 1,
			elementWordSize: 4,
			byteAddress: 0,
			elementByteLength: 4,
			allocationUnitAddress: 0,
			allocationUnitCount: 1,
			allocatedByteLength: 4,
			endByteAddress: 0,
			endAddressSafeByteLength: 4,
			lineNumber: 0,
			isInteger: false,
			pointerDepth: 0,
			isUnsigned: false,
		},
	};
	const widgets: ConnectorWidgets = { inputs: [], outputs: [output] };
	const buffer = new ArrayBuffer(64);
	const memory = {
		int8: new Int8Array(buffer),
		int16: new Int16Array(buffer),
		int32: new Int32Array(buffer),
		uint8: new Uint8Array(buffer),
		uint16: new Uint16Array(buffer),
		float32: new Float32Array(buffer),
		float64: new Float64Array(buffer),
	};
	return { engine, drawSprite, state, widgets, output, memory };
}

describe('drawConnectors', () => {
	it.each([
		[6, 10],
		[8, 16],
		[16, 32],
	])('composes an input from a fill and primary brackets at %ix%i', (width, height) => {
		const { engine, drawSprite, state, widgets, memory } = fixture(width, height);
		widgets.outputs = [];
		widgets.inputs.push({
			codeBlock: createMockCodeBlock(),
			x: 2,
			y: 3,
			width: width * 3,
			height,
			wireX: 0,
			wireY: 0,
			id: 'input',
			allocationUnitAddress: 0,
		});

		drawConnectors(engine, state, widgets, memory);

		expect(drawSprite.mock.calls).toEqual([
			[2, 3, 128, PALETTE_INDICES.surfaceOverlay, width * 3, height],
			[2, 3, 91, PALETTE_INDICES.primaryBase, width, height],
			[2 + width * 2, 3, 93, PALETTE_INDICES.primaryBase, width, height],
		]);
	});

	it.each([
		[-1, PALETTE_INDICES.primaryDark3],
		[-0.6, PALETTE_INDICES.primaryDark2],
		[-0.2, PALETTE_INDICES.primaryDark1],
		[0.2, PALETTE_INDICES.primaryBase],
		[0.6, PALETTE_INDICES.warningBase],
		[1, PALETTE_INDICES.negativeBase],
	])('composes output value %s with the matching star and secondary brackets', (value, star) => {
		const { engine, drawSprite, state, widgets, memory } = fixture();
		memory.float32[0] = value;

		drawConnectors(engine, state, widgets, memory);

		expect(drawSprite.mock.calls).toEqual([
			[2, 3, 128, PALETTE_INDICES.surfaceOverlay, 24, 16],
			[2, 3, 91, PALETTE_INDICES.secondaryBase, 8, 16],
			[10, 3, 42, star, 8, 16],
			[18, 3, 93, PALETTE_INDICES.secondaryBase, 8, 16],
		]);
	});

	it('reads integer outputs by allocation-unit address', () => {
		const { engine, drawSprite, state, widgets, output, memory } = fixture();
		output.memory.isInteger = true;
		output.memory.allocationUnitAddress = 3;
		memory.int32[3] = -1;
		memory.int32[0] = 1;

		drawConnectors(engine, state, widgets, memory);

		expect(drawSprite).toHaveBeenNthCalledWith(3, 10, 3, 42, PALETTE_INDICES.primaryDark3, 8, 16);
	});

	it('reads float64 outputs by byte address rather than float32 index', () => {
		const { engine, drawSprite, state, widgets, output, memory } = fixture();
		output.memory.isFloat64 = true;
		output.memory.byteAddress = 16;
		output.memory.allocationUnitAddress = 4;
		memory.float64[2] = 1;

		drawConnectors(engine, state, widgets, memory);

		expect(drawSprite).toHaveBeenNthCalledWith(3, 10, 3, 42, PALETTE_INDICES.negativeBase, 8, 16);
	});

	it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
		'treats non-finite output %s as zero',
		value => {
			const { engine, drawSprite, state, widgets, output, memory } = fixture();
			memory.float32[0] = value;

			drawConnectors(engine, state, widgets, memory);

			expect(drawSprite).toHaveBeenNthCalledWith(3, 10, 3, 42, PALETTE_INDICES.primaryBase, 8, 16);
			expect([output.calibratedMin, output.calibratedMax]).toEqual([-1, 1]);
		}
	);

	it.each([
		[-10, -10, 1, PALETTE_INDICES.primaryDark3],
		[10, -1, 10, PALETTE_INDICES.negativeBase],
		[0, -1, 1, PALETTE_INDICES.primaryBase],
	])('updates calibration for %s before selecting the output color', (value, min, max, star) => {
		const { engine, drawSprite, state, widgets, output, memory } = fixture();
		output.calibratedMin = 0;
		output.calibratedMax = 0;
		memory.float32[0] = value;

		drawConnectors(engine, state, widgets, memory);

		expect([output.calibratedMin, output.calibratedMax]).toEqual([min, max]);
		expect(drawSprite).toHaveBeenNthCalledWith(3, 10, 3, 42, star, 8, 16);
	});

	it('retains the first scale color when finite float64 calibration overflows', () => {
		const { engine, drawSprite, state, widgets, output, memory } = fixture();
		output.memory.isFloat64 = true;
		output.calibratedMin = -1e308;
		output.calibratedMax = 1e308;
		memory.float64[0] = 1e308;

		drawConnectors(engine, state, widgets, memory);

		expect(drawSprite).toHaveBeenNthCalledWith(3, 10, 3, 42, PALETTE_INDICES.primaryDark3, 8, 16);
	});
});
