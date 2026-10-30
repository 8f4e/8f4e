import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { MemoryDefaults, PlannedMemoryDeclaration } from '@8f4e/language-spec';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ConnectorWidgets } from '../../types';

const findWidgetById = <T extends { id: string }>(widgets: T[], id: string) => widgets.find(widget => widget.id === id);

import updateOutputsGraphicData from './updateGraphicData';

function createMemory(overrides: Partial<PlannedMemoryDeclaration> = {}): PlannedMemoryDeclaration {
	return {
		id: 'output1',
		numberOfElements: 1,
		elementWordSize: 4,
		type: 'int' as const,
		byteAddress: 20,
		allocationUnitAddress: 5,
		allocationUnitCount: 1,
		elementByteLength: 4,
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

function setModuleMemory(
	state: State,
	memory: Record<string, PlannedMemoryDeclaration>,
	memoryDefaults: MemoryDefaults
): void {
	const plannedModule = {
		id: 'test-block',
		lineNumber: 0,
		byteAddress: 0,
		allocationUnitCount: 1,
		allocatedByteLength: 4,
		endByteAddress: 4,
		endAddressSafeByteLength: 0,
		memory,
		declarations: Object.values(memory),
		declarationSources: [],
	};
	state.compiler.memoryPlan.modules['test-block'] = plannedModule;
	state.compiler.memoryPlan.moduleList = [plannedModule];
	state.compiler.memoryDefaultsByModuleId['test-block'] = memoryDefaults;
}

describe('updateOutputsGraphicData', () => {
	let mockGraphicData: CodeBlockGraphicData;
	let mockState: State;
	let widgets: ConnectorWidgets;

	beforeEach(() => {
		widgets = { inputs: [], outputs: [] };
		mockGraphicData = createMockCodeBlock({
			name: 'test-block',
			code: ['module test-block', 'int output1'],
			width: 100,
			gaps: new Map(),
		});

		mockState = createMockState();
		setModuleMemory(mockState, { output1: createMemory() }, { output1: { value: 0, isInherited: false } });
	});

	it('adds output widgets from non-pointer scalar memory metadata', () => {
		updateOutputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.outputs.length).toBe(1);
		expect(findWidgetById(widgets.outputs, 'output1')).toBeDefined();
	});

	it('adds output widgets from non-pointer array memory metadata', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory['output1'] = createMemory({
			type: 'int' as const,
			numberOfElements: 4,
			allocationUnitCount: 4,
		});

		updateOutputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.outputs.length).toBe(1);
		expect(findWidgetById(widgets.outputs, 'output1')).toBeDefined();
	});

	it('ignores pointer memory metadata', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory['output1'] = createMemory({
			type: 'int*' as const,
			pointerDepth: 1,
		});

		updateOutputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.outputs.length).toBe(0);
	});

	it('calculates dimensions and position from metadata', () => {
		updateOutputsGraphicData(mockGraphicData, mockState, widgets);

		const output = findWidgetById(widgets.outputs, 'output1');
		const { codeBlock: _codeBlock, memory: _memory, ...outputWithoutRefs } = output || {};
		expect(outputWithoutRefs).toMatchSnapshot();
		expect(output?.codeBlock).toBe(mockGraphicData);
	});

	it('renders a group exposure at the backing memory address', () => {
		const targetMemory = createMemory({ id: 'value', byteAddress: 44, allocationUnitAddress: 11 });
		mockGraphicData = createMockCodeBlock({
			name: 'audio',
			code: ['group audio', 'expose publicValue &source:value', 'groupEnd'],
			width: 100,
			gaps: new Map(),
			nestedProjectCodeBlocks: [],
		});
		mockState.compiler.projectMemoryExposuresByGroupPath.audio = [
			{
				name: 'publicValue',
				targetModuleName: 'source',
				targetMemoryName: 'value',
				groupPath: 'audio',
				targetModuleId: 'audio/source',
				targetMemory,
			},
		];

		updateOutputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.outputs).toHaveLength(1);
		expect(widgets.outputs[0]).toMatchObject({ id: 'publicValue', y: 16 });
	});

	it('does not add outputs when compiled module metadata is missing', () => {
		mockState.compiler.memoryPlan.modules = {};

		updateOutputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.outputs.length).toBe(0);
	});

	it('does not render outputs for private entities', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory['_privateOutput'] = createMemory({
			id: '_privateOutput',
			allocationUnitAddress: 7,
			byteAddress: 28,
		});
		mockState.compiler.memoryDefaultsByModuleId['test-block']!._privateOutput = { value: 0, isInherited: false };
		delete mockState.compiler.memoryPlan.modules['test-block']!.memory['output1'];

		updateOutputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.outputs.length).toBe(0);
	});

	it('renders anonymous scalar allocations from metadata', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory['__anonymous__1'] = createMemory({
			id: '__anonymous__1',
			allocationUnitAddress: 8,
			byteAddress: 32,
		});
		mockState.compiler.memoryDefaultsByModuleId['test-block']!.__anonymous__1 = { value: 0, isInherited: false };
		delete mockState.compiler.memoryPlan.modules['test-block']!.memory['output1'];

		updateOutputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.outputs.length).toBe(1);
		expect(findWidgetById(widgets.outputs, '__anonymous__1')).toBeDefined();
	});

	it('clears existing outputs before updating', () => {
		widgets.outputs.push({
			codeBlock: mockGraphicData,
			width: 0,
			height: 0,
			x: 0,
			y: 0,
			wireX: 0,
			wireY: 0,
			id: 'oldOutput',
			calibratedMax: 1,
			calibratedMin: 0,
			memory: createMemory({ id: 'oldOutput' }),
		});

		updateOutputsGraphicData(mockGraphicData, mockState, widgets);

		expect(findWidgetById(widgets.outputs, 'oldOutput')).toBeUndefined();
	});

	it('handles multiple outputs in line-number order', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory['output2'] = createMemory({
			id: 'output2',
			type: 'float' as const,
			allocationUnitAddress: 6,
			byteAddress: 24,
			lineNumber: 2,
			isInteger: false,
		});
		mockState.compiler.memoryDefaultsByModuleId['test-block']!.output2 = { value: 0, isInherited: false };

		updateOutputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.outputs.length).toBe(2);

		const entries = Object.entries(widgets.outputs).map(([key, value]) => {
			const { codeBlock: _codeBlock, memory: _memory, ...rest } = value;
			return [key, rest];
		});
		expect(entries).toMatchSnapshot();
	});

	it('positions outputs at the metadata line number', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory['output1'] = createMemory({ lineNumber: 2 });

		updateOutputsGraphicData(mockGraphicData, mockState, widgets);

		const output = findWidgetById(widgets.outputs, 'output1');
		const { codeBlock: _codeBlock, memory: _memory, ...outputWithoutRefs } = output || {};
		expect(outputWithoutRefs).toMatchSnapshot();
	});

	it('positions shape-sourced outputs below the shape instruction', () => {
		mockGraphicData.gaps = new Map([[1, { size: 2 }]]);
		mockState.compiler.memoryPlan.modules['test-block']!.memory = {
			input1: createMemory({
				id: 'input1',
				type: 'int*' as const,
				pointerDepth: 1,
				lineNumber: 1,
			}),
			output1: createMemory({ lineNumber: 1 }),
		};
		mockState.compiler.memoryDefaultsByModuleId['test-block'] = {
			input1: { value: 0, isInherited: true },
			output1: { value: 0, isInherited: true },
		};

		updateOutputsGraphicData(mockGraphicData, mockState, widgets);

		expect(findWidgetById(widgets.outputs, 'output1')?.y).toBe(48);
	});

	it('rounds wire coordinates to whole pixels', () => {
		mockState.viewport.vGrid = 9;
		mockState.viewport.hGrid = 17;
		mockGraphicData.width = 90;

		updateOutputsGraphicData(mockGraphicData, mockState, widgets);

		const output = findWidgetById(widgets.outputs, 'output1');
		expect(output?.wireX).toBe(77);
		expect(output?.wireY).toBe(26);
	});
});
