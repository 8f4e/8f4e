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

describe('meter directive widget resolution', () => {
	let mockGraphicData: CodeBlockGraphicData;
	let mockState: State;

	beforeEach(() => {
		mockGraphicData = createMockCodeBlock({
			name: 'test-block',
			code: ['; @meter level'],
			gaps: new Map(),
			width: 100,
		});

		mockState = createMockState({
			viewport: {
				vGrid: 10,
				hGrid: 20,
			},
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
								level: {
									allocationUnitAddress: 0,
									byteAddress: 0,
									numberOfElements: 1,
									elementWordSize: 4,
									type: 'float' as const,
									allocationUnitCount: 1,
									default: 0,
									isInteger: false,
									id: 'level',
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

	it('adds a meter widget for a scalar memory id', () => {
		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayMeters).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayMeters[0].minValue).toBe(-1);
		expect(mockGraphicData.widgets.arrayMeters[0].maxValue).toBe(1);
		expect(mockGraphicData.widgets.arrayMeters[0].height).toBe(20);
		expect(mockGraphicData.widgets.arrayMeters[0].isBipolar).toBe(true);
		expect(mockGraphicData.widgets.arrayMeters[0].amplitudeLimit).toBe(1);
		expect(mockGraphicData.widgets.arrayMeters[0].staticValueIndex).toBe(0);
	});

	it('uses explicit range overrides when provided', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @meter level 0 1']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayMeters).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayMeters[0].minValue).toBe(0);
		expect(mockGraphicData.widgets.arrayMeters[0].maxValue).toBe(1);
	});

	it('clears existing meters before resolving directive widgets', () => {
		mockGraphicData.widgets.arrayMeters.push({
			width: 0,
			height: 0,
			x: 0,
			y: 0,
			minValue: 0,
			maxValue: 1,
			isBipolar: false,
			amplitudeLimit: 0,
			inverseValueRange: 1,
			greenEndX: 0,
			yellowEndX: 0,
			overloadMarkerX: 0,
			overloadMarkerWidth: 0,
			staticValueIndex: 0,
			memory: {
				memory: { allocationUnitAddress: 0 } as PlannedMemoryDeclaration,
				showAddress: false,
				showEndAddress: false,
				bufferPointer: 0,
				displayFormat: 'decimal',
			} as MemoryIdentifier,
			baseSampleShift: 2,
			valueType: 'float32',
		});

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayMeters).toHaveLength(1);
	});

	it('does not add a meter when the memory cannot be resolved', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @meter missing']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayMeters).toHaveLength(0);
	});

	it('infers the memory id from a trailing memory declaration comment', () => {
		setMockCodeBlockCode(mockGraphicData, ['float out ; @meter']);
		mockState.compiler.memoryPlan.modules['test-block']!.memory['out'] = {
			allocationUnitAddress: 4,
			byteAddress: 16,
			numberOfElements: 1,
			elementWordSize: 4,
			type: 'float' as const,
			allocationUnitCount: 1,
			default: 0,
			isInteger: false,
			id: 'out',
			pointerDepth: 0,
		};

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayMeters).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayMeters[0].memory.memory.id).toBe('out');
		expect(mockGraphicData.widgets.arrayMeters[0].staticValueIndex).toBe(4);
	});
});
