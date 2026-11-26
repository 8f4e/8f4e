import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import { createFrameBlockPositionsFixture } from './__tests__/blockPositionsFixture';
import { visitConnections } from './connections';
import type { WireEndpoints, WireInput, WireOutput } from './deriveEndpoints';

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
		const input: WireInput = {
			x: 15,
			y: 45,
			source: kind === 'reference' ? { kind, byteAddress: outputAddress } : { kind, allocationUnitAddress: 2 },
		};
		const output: WireOutput = {
			codeBlock: outputBlock,
			x: 155,
			y: 63,
			byteAddress: outputAddress,
		};
		const endpointsByBlock = new WeakMap([[inputBlock, { inputs: [input], outputs: [] } satisfies WireEndpoints]]);
		const outputsByByteAddress = new Map([[outputAddress, output]]);

		const state = createMockState({
			viewport: {
				x: 5,
				y: 9,
				vGrid: 10,
				hGrid: 18,
			},
			project: {
				activeLevel: { entries: [], path: '', blocks: [inputBlock, outputBlock] },
				selectedCodeBlock: inputBlock,
			},
		});
		const visit = vi.fn();
		const memory = Int32Array.from(kind === 'reference' ? [] : [0, 0, outputAddress]);
		visitConnections(
			state,
			createFrameBlockPositionsFixture(state),
			memory,
			{ endpointsByBlock, outputsByByteAddress },
			visit
		);
		expect(visit).toHaveBeenCalledExactlyOnceWith(110, 236, 450, 454, true);
	});
});
