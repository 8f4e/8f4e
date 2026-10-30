import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { MemoryDefaults, PlannedMemoryDeclaration } from '@8f4e/language-spec';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ConnectorWidgets } from '../../types';

const findWidgetById = <T extends { id: string }>(widgets: T[], id: string) => widgets.find(widget => widget.id === id);

import updateInputsGraphicData from './updateGraphicData';

function createMemory(overrides: Partial<PlannedMemoryDeclaration> = {}): PlannedMemoryDeclaration {
	return {
		id: 'input1',
		numberOfElements: 1,
		elementWordSize: 4,
		type: 'int*' as const,
		byteAddress: 20,
		allocationUnitAddress: 5,
		allocationUnitCount: 1,
		elementByteLength: 4,
		allocatedByteLength: 4,
		endByteAddress: 24,
		endAddressSafeByteLength: 4,
		lineNumber: 1,
		isInteger: true,
		pointerDepth: 1,
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

describe('updateInputsGraphicData', () => {
	let mockGraphicData: CodeBlockGraphicData;
	let mockState: State;
	let widgets: ConnectorWidgets;

	beforeEach(() => {
		widgets = { inputs: [], outputs: [] };
		mockGraphicData = createMockCodeBlock({
			name: 'test-block',
			code: ['module test-block', 'int* input1'],
			gaps: new Map(),
		});

		mockState = createMockState();
		setModuleMemory(mockState, { input1: createMemory() }, { input1: { value: 0, isInherited: false } });
	});

	it('adds input widgets from pointer scalar memory metadata', () => {
		updateInputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.inputs.length).toBe(1);
		expect(findWidgetById(widgets.inputs, 'input1')).toBeDefined();
	});

	it('renders a pointer exposure as a group input backed by the target pointer slot', () => {
		const targetMemory = createMemory({ id: 'input', byteAddress: 36, allocationUnitAddress: 9 });
		mockGraphicData = createMockCodeBlock({
			name: 'audio',
			code: ['group audio', 'expose publicInput &consumer:input', 'groupEnd'],
			gaps: new Map(),
			nestedProjectCodeBlocks: [],
		});
		mockState.compiler.projectMemoryExposuresByGroupPath.audio = [
			{
				name: 'publicInput',
				targetModuleName: 'consumer',
				targetMemoryName: 'input',
				groupPath: 'audio',
				targetModuleId: 'audio/consumer',
				targetMemory,
			},
		];

		updateInputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.inputs).toHaveLength(1);
		expect(widgets.inputs[0]).toMatchObject({
			id: 'publicInput',
			y: 16,
			allocationUnitAddress: 9,
		});
	});

	it('ignores non-pointer memory metadata', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory['input1'] = createMemory({
			type: 'int' as const,
			pointerDepth: 0,
		});

		updateInputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.inputs.length).toBe(0);
	});

	it('adds input widgets from pointer array memory metadata', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory['input1'] = createMemory({
			type: 'float*' as const,
			pointerDepth: 1,
		});

		updateInputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.inputs.length).toBe(1);
		expect(findWidgetById(widgets.inputs, 'input1')).toBeDefined();
	});

	it('calculates dimensions and position from metadata', () => {
		updateInputsGraphicData(mockGraphicData, mockState, widgets);

		const input = findWidgetById(widgets.inputs, 'input1');
		const { codeBlock: _codeBlock, ...inputWithoutCodeBlock } = input || {};
		expect(inputWithoutCodeBlock).toMatchSnapshot();
		expect(input?.codeBlock).toBe(mockGraphicData);
	});

	it('does not add inputs when compiled module metadata is missing', () => {
		mockState.compiler.memoryPlan.modules = {};

		updateInputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.inputs.length).toBe(0);
	});

	it('clears existing inputs before updating', () => {
		widgets.inputs.push({
			codeBlock: mockGraphicData,
			width: 0,
			height: 0,
			x: 0,
			y: 0,
			wireX: 0,
			wireY: 0,
			id: 'oldInput',
			allocationUnitAddress: 0,
		});

		updateInputsGraphicData(mockGraphicData, mockState, widgets);

		expect(findWidgetById(widgets.inputs, 'oldInput')).toBeUndefined();
	});

	it('handles multiple inputs in line-number order', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory['input2'] = createMemory({
			id: 'input2',
			type: 'float*' as const,
			allocationUnitAddress: 6,
			byteAddress: 24,
			lineNumber: 2,
			isInteger: false,
		});
		mockState.compiler.memoryDefaultsByModuleId['test-block']!.input2 = { value: 0, isInherited: false };

		updateInputsGraphicData(mockGraphicData, mockState, widgets);

		expect(widgets.inputs.length).toBe(2);
		const entries = Object.entries(widgets.inputs).map(([key, value]) => {
			const { codeBlock: _codeBlock, ...rest } = value;
			return [key, rest];
		});
		expect(entries).toMatchSnapshot();
	});

	it('positions inputs at the metadata line number', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory['input1'] = createMemory({ lineNumber: 2 });

		updateInputsGraphicData(mockGraphicData, mockState, widgets);

		const input = findWidgetById(widgets.inputs, 'input1');
		const { codeBlock: _codeBlock, ...inputWithoutCodeBlock } = input || {};
		expect(inputWithoutCodeBlock).toMatchSnapshot();
	});

	it('positions shape-sourced inputs below the shape instruction', () => {
		mockGraphicData.gaps = new Map([[1, { size: 1 }]]);
		mockState.compiler.memoryPlan.modules['test-block']!.memory['input1'] = createMemory({
			lineNumber: 1,
		});
		mockState.compiler.memoryDefaultsByModuleId['test-block'] = {
			input1: { value: 0, isInherited: true },
		};

		updateInputsGraphicData(mockGraphicData, mockState, widgets);

		expect(findWidgetById(widgets.inputs, 'input1')?.y).toBe(32);
	});

	it('rounds wire coordinates to whole pixels', () => {
		mockState.viewport.vGrid = 9;
		mockState.viewport.hGrid = 17;

		updateInputsGraphicData(mockGraphicData, mockState, widgets);

		const input = findWidgetById(widgets.inputs, 'input1');
		expect(input?.wireX).toBe(14);
		expect(input?.wireY).toBe(26);
	});
});
