import type { CodeBlockGraphicData, MemoryIdentifier, State } from '@8f4e/editor-state-types';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	createMockCodeBlock,
	createMockState,
	deriveDirectiveStateForMockCodeBlock,
	setMockCodeBlockCode,
} from '~/pureHelpers/testingUtils/testUtils';
import { runBeforeGraphicDataWidthCalculation, runBlockLayoutReady } from '../registry';

describe('plot directive widget resolution', () => {
	let mockGraphicData: CodeBlockGraphicData;
	let mockState: State;

	beforeEach(() => {
		mockGraphicData = createMockCodeBlock({
			name: 'test-block',
			code: ['; @plot &buffer1 count(buffer1)'],
			gaps: new Map(),
			width: 100,
		});

		mockState = createMockState({
			codeBlockRendering: {
				viewport: {
					vGrid: 10,
					hGrid: 20,
				},
			},
			compiler: {
				memoryPlan: {
					modules: {
						'test-block': {
							id: 'test-block',
							lineNumber: 0,
							byteAddress: 0,
							allocationUnitCount: 0,
							allocatedByteLength: 0,
							endByteAddress: 0,
							endAddressSafeByteLength: 0,
							memory: {
								buffer1: {
									allocationUnitAddress: 0,
									byteAddress: 0,
									numberOfElements: 16,
									elementWordSize: 1,
									type: 'int' as const,
									allocationUnitCount: 16,
									default: 0,
									isInteger: true,
									isUnsigned: false,
									id: 'buffer1',
									pointerDepth: 0,
								},
							},
							declarations: [],
							declarationSources: [],
						},
					},
					moduleList: [],
				},
			},
		});
	});

	function runDirectiveResolution() {
		const directiveState = deriveDirectiveStateForMockCodeBlock(mockGraphicData);
		runBeforeGraphicDataWidthCalculation(mockGraphicData, mockState, directiveState);
		runBlockLayoutReady(mockGraphicData, mockState, directiveState);
	}

	it('adds a plotter to graphic data widgets', () => {
		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayPlotters).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayPlotters[0]).toBeDefined();
	});

	it('does not add a plotter when the array cannot be resolved', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @plot missing count(buffer1)']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayPlotters).toHaveLength(0);
	});

	it('clears existing plotters before resolving directive widgets', () => {
		mockGraphicData.widgets.arrayPlotters.push({
			width: 0,
			height: 0,
			x: 0,
			y: 0,
			minValue: -8,
			maxValue: 8,
			startAddress: {
				memory: { allocationUnitAddress: 0 } as PlannedMemoryDeclaration,
				showAddress: true,
				showEndAddress: false,
				bufferPointer: 0,
				displayFormat: 'decimal',
			} as MemoryIdentifier,
			baseSampleShift: 0,
			length: 16,
			valueType: 'int8',
		});

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayPlotters).toHaveLength(1);
	});

	it('handles multiple plot directives', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @plot &buffer1 count(buffer1)', '; @plot &buffer2 count(buffer2)']);
		mockState.compiler.memoryPlan.modules['test-block']!.memory['buffer2'] = {
			allocationUnitAddress: 1,
			byteAddress: 4,
			numberOfElements: 100,
			elementWordSize: 1,
			type: 'int*' as const,
			allocationUnitCount: 100,
			default: 0,
			isInteger: true,
			id: 'buffer2',
			pointerDepth: 0,
		};

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayPlotters).toHaveLength(2);
	});

	it('derives float plot ranges as -1..1', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory['floatBuffer'] = {
			allocationUnitAddress: 4,
			byteAddress: 16,
			numberOfElements: 16,
			elementWordSize: 4,
			type: 'float' as const,
			allocationUnitCount: 16,
			default: 0,
			isInteger: false,
			id: 'floatBuffer',
			pointerDepth: 0,
		};
		setMockCodeBlockCode(mockGraphicData, ['; @plot &floatBuffer count(floatBuffer)']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayPlotters).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayPlotters[0].minValue).toBe(-1);
		expect(mockGraphicData.widgets.arrayPlotters[0].maxValue).toBe(1);
	});

	it('derives integer plot ranges from the array type', () => {
		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayPlotters).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayPlotters[0].minValue).toBe(-128);
		expect(mockGraphicData.widgets.arrayPlotters[0].maxValue).toBe(127);
	});

	it('does not add a plotter when the required length cannot be resolved', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @plot &buffer1 missingLength']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayPlotters).toHaveLength(0);
	});

	it('uses explicit range overrides when provided with a length', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @plot &buffer1 8 -10 10']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayPlotters).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayPlotters[0].minValue).toBe(-10);
		expect(mockGraphicData.widgets.arrayPlotters[0].maxValue).toBe(10);
		expect(mockGraphicData.widgets.arrayPlotters[0].length).toBe(8);
	});

	it('supports pointer starts with count() lengths', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory['bufferPtr'] = {
			allocationUnitAddress: 8,
			byteAddress: 32,
			numberOfElements: 1,
			elementWordSize: 4,
			type: 'int*' as const,
			allocationUnitCount: 1,
			default: 0,
			isInteger: true,
			id: 'bufferPtr',
			pointeeBaseType: 'int8',
			pointerDepth: 1,
		};
		setMockCodeBlockCode(mockGraphicData, ['; @plot bufferPtr count(buffer1)']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayPlotters).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayPlotters[0].length).toBe(16);
		expect(mockGraphicData.widgets.arrayPlotters[0].valueType).toBe('int8');
	});
});
