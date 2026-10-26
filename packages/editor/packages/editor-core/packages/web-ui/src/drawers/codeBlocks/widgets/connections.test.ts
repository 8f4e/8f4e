import { createMockCodeBlock, createMockSpriteLookups, createMockState } from '@8f4e/editor-state-testing';
import type { Input, Output } from '@8f4e/editor-state-types';
import type { LineDrawer } from 'glugglugglug';
import { describe, expect, it, vi } from 'vitest';
import type { MemoryViews } from '../../../types';
import type { WireColors } from '../../../wire-colors';
import drawConnections from './connections';

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

function createMockLines(): LineDrawer {
	return {
		drawLine: vi.fn(),
	} as unknown as LineDrawer;
}

describe('drawConnections', () => {
	it.each([0, 80])('draws a wire to output address %i', outputAddress => {
		const inputBlock = createMockCodeBlock({
			name: 'inputModule',
			x: 100,
			y: 200,
		});
		const outputBlock = createMockCodeBlock({
			name: 'outputModule',
			x: 300,
			y: 400,
		});
		const input: Input = {
			codeBlock: inputBlock,
			width: 30,
			height: 18,
			x: 0,
			y: 36,
			wireX: 15,
			wireY: 45,
			id: 'in',
			allocationUnitAddress: 2,
		};
		const output: Output = {
			codeBlock: outputBlock,
			width: 30,
			height: 18,
			x: 140,
			y: 54,
			wireX: 155,
			wireY: 63,
			id: 'out',
			calibratedMax: 0,
			calibratedMin: 0,
			memory: {
				byteAddress: outputAddress,
				allocationUnitAddress: 20,
				allocationUnitCount: 1,
			} as never,
		};
		inputBlock.widgets.inputs = [input];

		const state = createMockState({
			viewport: {
				x: 5,
				y: 9,
				vGrid: 10,
				hGrid: 18,
			},
			compiler: {
				compiledModules: {
					inputModule: {
						memory: {
							in: {
								byteAddress: 8,
								allocationUnitAddress: 2,
								allocationUnitCount: 1,
							},
						},
					},
				},
			},
			spriteLookups: createMockSpriteLookups() as never,
			codeBlockRendering: {
				codeBlocks: [inputBlock, outputBlock],
				selectedCodeBlock: inputBlock,
				outputsByWordAddress: new Map([[outputAddress, output]]),
			},
		});
		const lines = createMockLines();
		const wireColors: WireColors = {
			wire: [1, 1, 1, 0.3],
			wireHighlighted: [1, 1, 1, 1],
		};

		drawConnections(lines, wireColors, state, createMemoryViews({ int32: [0, 0, outputAddress] }));

		expect(lines.drawLine).toHaveBeenCalledWith(110, 236, 450, 454, 2, wireColors.wireHighlighted);
	});
});
