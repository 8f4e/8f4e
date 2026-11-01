import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import deriveConnectors from './deriveConnectors';

function createMemory(overrides: Partial<PlannedMemoryDeclaration> = {}): PlannedMemoryDeclaration {
	return {
		id: 'value',
		type: 'int',
		numberOfElements: 1,
		elementWordSize: 4,
		elementByteLength: 4,
		byteAddress: 20,
		allocationUnitAddress: 5,
		allocationUnitCount: 1,
		allocatedByteLength: 4,
		endByteAddress: 24,
		endAddressSafeByteLength: 4,
		lineNumber: 1,
		isInteger: true,
		pointerDepth: 0,
		isUnsigned: false,
		...overrides,
	};
}

function setMemories(state: State, memories: PlannedMemoryDeclaration[], inheritedIds: string[] = []) {
	const module = {
		id: 'test-block',
		lineNumber: 0,
		byteAddress: 0,
		allocationUnitCount: 1,
		allocatedByteLength: 4,
		endByteAddress: 4,
		endAddressSafeByteLength: 4,
		memory: Object.fromEntries(memories.map(memory => [memory.id, memory])),
		declarations: memories,
		declarationSources: [],
	};
	state.compiler.result.memoryPlan = { modules: { 'test-block': module }, moduleList: [module] };
	state.compiler.result.memoryDefaultsByModuleId['test-block'] = Object.fromEntries(
		memories.map(memory => [memory.id, { value: 0, isInherited: inheritedIds.includes(memory.id) }])
	);
}

describe('deriveConnectors', () => {
	it('partitions scalar and array declarations into ordered inputs and outputs', () => {
		const state = createMockState();
		const block = createMockCodeBlock({ name: 'test-block', width: 100, gaps: new Map([[1, { size: 1 }]]) });
		const output = createMemory({ id: 'output', lineNumber: 3 });
		const buffer = createMemory({ id: 'buffer', lineNumber: 5, numberOfElements: 4, allocationUnitCount: 4 });
		setMemories(state, [
			output,
			createMemory({ id: 'input', type: 'int*', pointerDepth: 1, allocationUnitAddress: 1 }),
			buffer,
			createMemory({
				id: '_arrayInput',
				type: 'float*',
				pointerDepth: 1,
				lineNumber: 4,
				allocationUnitAddress: 2,
				numberOfElements: 4,
				allocationUnitCount: 4,
			}),
		]);

		const widgets = deriveConnectors(block, state);

		expect(widgets.inputs).toEqual([
			{ x: 0, y: 16, wireX: 12, wireY: 24, allocationUnitAddress: 1 },
			{ x: 0, y: 80, wireX: 12, wireY: 88, allocationUnitAddress: 2 },
		]);
		expect(widgets.outputs).toMatchObject([
			{ x: 76, y: 64, wireX: 88, wireY: 72, calibratedMin: 0, calibratedMax: 0 },
			{ x: 76, y: 96, wireX: 88, wireY: 104 },
		]);
		expect(widgets.outputs[0].memory).toBe(output);
		expect(widgets.outputs[1].memory).toBe(buffer);
		expect(widgets.outputs[0].codeBlock).toBe(block);
	});

	it.each([
		['_private', 0],
		['__anonymous__1', 1],
		['value', 1],
	] as const)('derives %s with %i public outputs', (id, count) => {
		const state = createMockState();
		setMemories(state, [createMemory({ id })]);
		expect(deriveConnectors(createMockCodeBlock(), state).outputs).toHaveLength(count);
	});

	it('returns no connectors before compilation or while the block name is incomplete', () => {
		const state = createMockState();
		expect(deriveConnectors(createMockCodeBlock(), state)).toEqual({ inputs: [], outputs: [] });
		setMemories(state, [createMemory()]);
		expect(deriveConnectors(createMockCodeBlock({ name: '' }), state)).toEqual({ inputs: [], outputs: [] });
	});

	it('keeps inherited input and output rows aligned below a shared shape declaration', () => {
		const state = createMockState();
		const block = createMockCodeBlock({ gaps: new Map([[1, { size: 2 }]]) });
		setMemories(
			state,
			[createMemory({ id: 'input', type: 'int*', pointerDepth: 1 }), createMemory({ id: 'output' })],
			['input', 'output']
		);

		const widgets = deriveConnectors(block, state);

		expect(widgets.inputs[0].y).toBe(32);
		expect(widgets.outputs[0].y).toBe(48);
	});

	it('rounds wire anchors to whole pixels for odd font dimensions', () => {
		const state = createMockState({ viewport: { vGrid: 9, hGrid: 17 } });
		setMemories(state, [createMemory({ id: 'input', type: 'int*', pointerDepth: 1 }), createMemory({ id: 'output' })]);
		const widgets = deriveConnectors(createMockCodeBlock({ width: 90 }), state);

		expect(widgets.inputs[0]).toMatchObject({ wireX: 14, wireY: 26 });
		expect(widgets.outputs[0]).toMatchObject({ wireX: 77, wireY: 26 });
	});

	it('resolves public group aliases to their original backing metadata and source rows', () => {
		const state = createMockState();
		const input = createMemory({ id: '_input', type: 'int*', pointerDepth: 1, allocationUnitAddress: 9 });
		const output = createMemory({ id: '_privateValue', byteAddress: 44, allocationUnitAddress: 11 });
		const block = createMockCodeBlock({
			name: 'audio',
			width: 100,
			nestedProjectCodeBlocks: [],
			code: [
				'group audio',
				'expose publicInput &source:_input',
				'expose publicValue &source:_privateValue',
				'groupEnd',
			],
		});
		state.compiler.result.projectMemoryExposuresByGroupPath.audio = [
			{
				name: 'publicInput',
				targetModuleName: 'source',
				targetMemoryName: '_input',
				groupPath: 'audio',
				targetModuleId: 'audio/source',
				targetMemory: input,
			},
			{
				name: 'publicValue',
				targetModuleName: 'source',
				targetMemoryName: '_privateValue',
				groupPath: 'audio',
				targetModuleId: 'audio/source',
				targetMemory: output,
			},
		];

		const widgets = deriveConnectors(block, state);

		expect(widgets.inputs).toEqual([{ x: 0, y: 16, wireX: 12, wireY: 24, allocationUnitAddress: 9 }]);
		expect(widgets.outputs).toHaveLength(1);
		expect(widgets.outputs[0]).toMatchObject({ x: 76, y: 32, wireX: 88, wireY: 40 });
		expect(widgets.outputs[0].memory).toBe(output);
	});
});
