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

describe('bars directive widget resolution', () => {
	let mockGraphicData: CodeBlockGraphicData;
	let mockState: State;

	beforeEach(() => {
		mockGraphicData = createMockCodeBlock({
			name: 'test-block',
			code: ['; @bars &bins count(bins)'],
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
								bins: {
									allocationUnitAddress: 0,
									byteAddress: 0,
									numberOfElements: 16,
									elementWordSize: 4,
									type: 'float' as const,
									allocationUnitCount: 16,
									default: 0,
									isInteger: false,
									id: 'bins',
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

	it('adds a bars widget to graphic data widgets', () => {
		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayBars).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayBars[0].height).toBe(128);
		expect(mockGraphicData.widgets.arrayBars[0].minValue).toBe(-1);
		expect(mockGraphicData.widgets.arrayBars[0].maxValue).toBe(1);
		expect(mockGraphicData.widgets.arrayBars[0].inverseValueRange).toBe(0.5);
		expect(mockGraphicData.widgets.arrayBars[0].staticBaseValueIndex).toBe(0);
		expect(mockGraphicData.widgets.arrayBars[0].staticColumnLayout).toHaveLength(16);
	});

	it('does not add bars when the array cannot be resolved', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @bars missing count(bins)']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayBars).toHaveLength(0);
	});

	it('clears existing bars before resolving directive widgets', () => {
		mockGraphicData.widgets.arrayBars.push({
			width: 0,
			height: 0,
			x: 0,
			y: 0,
			minValue: 0,
			maxValue: 1,
			inverseValueRange: 1,
			staticBaseValueIndex: 0,
			staticColumnLayout: [],
			startAddress: {
				memory: { allocationUnitAddress: 0 } as PlannedMemoryDeclaration,
				showAddress: true,
				showEndAddress: false,
				bufferPointer: 0,
				displayFormat: 'decimal',
			} as MemoryIdentifier,
			baseSampleShift: 2,
			length: 16,
			valueType: 'float32',
		});

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayBars).toHaveLength(1);
	});

	it('uses explicit range overrides when provided', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @bars &bins 8 0 1']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayBars).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayBars[0].length).toBe(8);
		expect(mockGraphicData.widgets.arrayBars[0].minValue).toBe(0);
		expect(mockGraphicData.widgets.arrayBars[0].maxValue).toBe(1);
		expect(mockGraphicData.widgets.arrayBars[0].inverseValueRange).toBe(1);
		expect(mockGraphicData.widgets.arrayBars[0].staticColumnLayout).toHaveLength(8);
	});
});
