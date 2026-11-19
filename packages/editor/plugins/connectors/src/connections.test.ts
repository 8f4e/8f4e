import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import { visitConnections } from './connections';
import type { ConnectorWidgets, Input, Output } from './types';

describe('visitConnections', () => {
	it.each([
		{ kind: 'pointer', address: 0 },
		{ kind: 'pointer', address: 80 },
		{ kind: 'reference', address: 0 },
		{ kind: 'reference', address: 80 },
	] as const)('visits the connection for $kind to address $address', ({ kind, address: outputAddress }) => {
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
			source: kind === 'reference' ? { kind, byteAddress: outputAddress } : { kind, allocationUnitAddress: 2 },
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
				currentProject: { entries: [], path: '', blocks: [inputBlock, outputBlock] },
				selectedCodeBlock: inputBlock,
			},
		});
		const visit = vi.fn();
		const memory = Int32Array.from(kind === 'reference' ? [] : [0, 0, outputAddress]);
		visitConnections(state, memory, { widgetsByBlock, outputsByByteAddress }, visit);
		expect(visit).toHaveBeenCalledExactlyOnceWith(110, 236, 450, 454, true);
	});
});
