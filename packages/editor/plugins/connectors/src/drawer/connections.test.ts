import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { MemoryViews } from '@8f4e/web-ui';
import { describe, expect, it, vi } from 'vitest';
import type { LineDrawer } from '../line-drawer';
import type { ConnectorWidgets, Input, Output } from '../types';
import type { WireColors } from '../wire-colors';
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
			x: 0,
			y: 36,
			wireX: 15,
			wireY: 45,
			allocationUnitAddress: 2,
		};
		const output: Output = {
			codeBlock: outputBlock,
			x: 140,
			y: 54,
			wireX: 155,
			wireY: 63,
			calibratedMax: 0,
			calibratedMin: 0,
			memory: {
				byteAddress: outputAddress,
				allocationUnitAddress: 20,
				allocationUnitCount: 1,
			} as never,
		};
		const widgetsByBlock = new WeakMap([[inputBlock, { inputs: [input], outputs: [] } as ConnectorWidgets]]);
		const outputsByByteAddress = new Map([[outputAddress, output]]);

		const state = createMockState({
			viewport: {
				x: 5,
				y: 9,
				vGrid: 10,
				hGrid: 18,
			},
			codeBlockRendering: {
				currentProject: { path: '', blocks: [inputBlock, outputBlock] },
				selectedCodeBlock: inputBlock,
			},
		});
		const lines = createMockLines();
		const wireColors: WireColors = {
			wire: [1, 1, 1, 0.3],
			wireHighlighted: [1, 1, 1, 1],
		};

		drawConnections(
			lines,
			wireColors,
			state,
			createMemoryViews({ int32: [0, 0, outputAddress] }),
			widgetsByBlock,
			outputsByByteAddress
		);

		expect(lines.drawLine).toHaveBeenCalledWith(110, 236, 450, 454, 2, wireColors.wireHighlighted);
	});
});
