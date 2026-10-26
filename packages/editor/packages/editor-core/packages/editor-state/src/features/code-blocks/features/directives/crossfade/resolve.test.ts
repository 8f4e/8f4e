import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	createMockCodeBlock,
	createMockState,
	deriveDirectiveStateForMockCodeBlock,
	setMockCodeBlockCode,
} from '~/pureHelpers/testingUtils/testUtils';
import { runBeforeGraphicDataWidthCalculation, runBlockLayoutReady } from '../registry';

describe('crossfade directive widget resolution', () => {
	let mockGraphicData: CodeBlockGraphicData;
	let mockState: State;

	beforeEach(() => {
		mockGraphicData = createMockCodeBlock({
			name: 'test-block',
			code: ['float dry 0', 'float wet 0', '; @crossfade &dry &wet'],
			width: 200,
			gaps: new Map(),
		});

		mockState = createMockState({
			viewport: {
				vGrid: 10,
				hGrid: 20,
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
								dry: {
									id: 'dry',
									allocationUnitAddress: 0,
									byteAddress: 0,
									numberOfElements: 1,
									elementWordSize: 1,
									type: 'float' as const,
									allocationUnitCount: 1,
									default: 0,
									isInteger: false,
									isFloat64: false,
								},
								wet: {
									id: 'wet',
									allocationUnitAddress: 1,
									byteAddress: 4,
									numberOfElements: 1,
									elementWordSize: 1,
									type: 'float' as const,
									allocationUnitCount: 1,
									default: 0,
									isInteger: false,
									isFloat64: false,
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

	it('adds a crossfade widget for two float scalars', () => {
		runDirectiveResolution();

		expect(mockGraphicData.widgets.crossfades).toHaveLength(1);
		expect(mockGraphicData.widgets.crossfades[0]).toMatchObject({
			leftId: 'dry',
			rightId: 'wet',
			leftWordAddress: 0,
			rightWordAddress: 1,
			handleWidth: 10,
			trackWidth: 160,
			centerX: 80,
			height: 40,
		});
	});

	it('does not add a crossfade when the bound memory is not float32 scalar', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory.wet.isInteger = true;

		runDirectiveResolution();

		expect(mockGraphicData.widgets.crossfades).toHaveLength(0);
	});

	it('clears existing crossfades before resolving directive widgets', () => {
		mockGraphicData.widgets.crossfades.push({
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			leftId: 'oldLeft',
			rightId: 'oldRight',
			leftWordAddress: 0,
			rightWordAddress: 0,
			handleWidth: 0,
			trackWidth: 1,
			centerX: 0,
		});

		runDirectiveResolution();

		expect(mockGraphicData.widgets.crossfades).toHaveLength(1);
		expect(mockGraphicData.widgets.crossfades[0].leftId).toBe('dry');
	});

	it('ignores directives with unresolved memory ids', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @crossfade &dry &missing']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.crossfades).toHaveLength(0);
	});
});
