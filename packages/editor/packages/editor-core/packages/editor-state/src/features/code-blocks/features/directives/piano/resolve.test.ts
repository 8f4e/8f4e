import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	createMockCodeBlock,
	createMockState,
	deriveDirectiveStateForMockCodeBlock,
	setMockCodeBlockCode,
} from '~/pureHelpers/testingUtils/testUtils';
import { runBeforeGraphicDataWidthCalculation, runBlockLayoutReady } from '../registry';

describe('piano directive widget resolution', () => {
	let mockGraphicData: CodeBlockGraphicData;
	let mockState: State;

	beforeEach(() => {
		mockGraphicData = createMockCodeBlock({
			name: 'test-block',
			code: ['; @piano &keys1 &numKeys 60'],
			gaps: new Map(),
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
								keys1: {
									id: 'keys1',
									allocationUnitAddress: 5,
									byteAddress: 20,
									isInteger: true,
									allocationUnitCount: 10,
									numberOfElements: 10,
									elementWordSize: 1,
									type: 'int' as const,
									default: 0,
									pointerDepth: 0,
								},
								numKeys: {
									id: 'numKeys',
									allocationUnitAddress: 6,
									byteAddress: 24,
									isInteger: true,
									allocationUnitCount: 1,
									numberOfElements: 1,
									elementWordSize: 1,
									type: 'int' as const,
									default: 0,
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

	it('adds a piano keyboard to graphic data widgets', () => {
		runDirectiveResolution();

		expect(mockGraphicData.widgets.pianoKeyboards).toHaveLength(1);
	});

	it('resolves memory through code block name', () => {
		mockGraphicData.name = 'test-block';

		runDirectiveResolution();

		expect(mockGraphicData.widgets.pianoKeyboards).toHaveLength(1);
	});

	it('sets the minimum grid width during directive preparation', () => {
		const directiveState = deriveDirectiveStateForMockCodeBlock(mockGraphicData);
		runBeforeGraphicDataWidthCalculation(mockGraphicData, mockState, directiveState);

		expect(mockGraphicData.minGridWidth).toBe(48);
	});

	it('precomputes fixed key geometry', () => {
		runDirectiveResolution();

		expect(mockGraphicData.widgets.pianoKeyboards[0]).toMatchObject({
			height: 96,
			keyWidth: 16,
			keyY: 16,
			keyHeight: 80,
			blackKeyHeight: 48,
			blackKeySideY: 64,
			blackKeySideHeight: 32,
			blackKeyGapXOffset: 6,
			blackKeyGapY: 64,
			blackKeyGapWidth: 4,
			blackKeyGapHeight: 32,
		});
		expect(mockGraphicData.widgets.pianoKeyboards[0].keys[0].pressedOverlayRows).toEqual([16, 32, 48, 64, 80]);
		expect(mockGraphicData.widgets.pianoKeyboards[0].keys[1].pressedOverlayRows).toEqual([16, 32, 48]);
	});

	it('does not add a piano keyboard when memory cannot be resolved', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @piano &missing &numKeys 60']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.pianoKeyboards).toHaveLength(0);
	});

	it('clears existing piano keyboards before resolving directive widgets', () => {
		mockGraphicData.widgets.pianoKeyboards[5] = {
			pressedKeysListModuleId: 'test-block',
			pressedNumberOfKeysModuleId: 'test-block',
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			keyWidth: 8,
			keyY: 0,
			keyHeight: 0,
			blackKeyHeight: 0,
			blackKeySideY: 0,
			blackKeySideHeight: 0,
			blackKeyGapXOffset: 0,
			blackKeyGapY: 0,
			blackKeyGapWidth: 0,
			blackKeyGapHeight: 0,
			lineNumber: 0,
			keys: [],
			startingNumber: 60,
			pressedKeysListMemory: { allocationUnitAddress: 0 } as PlannedMemoryDeclaration,
			pressedNumberOfKeysMemory: { allocationUnitAddress: 0 } as PlannedMemoryDeclaration,
		};

		runDirectiveResolution();

		expect(mockGraphicData.widgets.pianoKeyboards).toHaveLength(1);
		expect(mockGraphicData.widgets.pianoKeyboards[5]).toBeUndefined();
	});
});
