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

describe('wave directive widget resolution', () => {
	let mockGraphicData: CodeBlockGraphicData;
	let mockState: State;

	beforeEach(() => {
		mockGraphicData = createMockCodeBlock({
			name: 'test-block',
			code: ['; @wave bufferAddress 16 pointer1'],
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
									type: 'int*' as const,
									allocationUnitCount: 16,
									default: 0,
									isInteger: true,
									id: 'buffer1',
									pointerDepth: 0,
								},
								bufferAddress: {
									allocationUnitAddress: 5,
									byteAddress: 20,
									numberOfElements: 1,
									elementWordSize: 4,
									type: 'int*' as const,
									allocationUnitCount: 1,
									default: 0,
									isInteger: true,
									id: 'bufferAddress',
									pointeeBaseType: 'int8',
									pointerDepth: 1,
								},
								pointer1: {
									allocationUnitAddress: 10,
									byteAddress: 40,
									numberOfElements: 1,
									elementWordSize: 4,
									type: 'int' as const,
									allocationUnitCount: 1,
									default: 0,
									isInteger: true,
									id: 'pointer1',
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

	it('adds a wave to graphic data widgets', () => {
		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayWaves).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayWaves[0].height).toBe(32);
	});

	it('does not add a wave when dependencies cannot be resolved', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @wave missingStart 16 pointer1']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayWaves).toHaveLength(0);
	});

	it('clears existing waves before resolving directive widgets', () => {
		mockGraphicData.widgets.arrayWaves.push({
			width: 0,
			height: 0,
			x: 0,
			y: 0,
			startAddress: {
				memory: { allocationUnitAddress: 0 } as PlannedMemoryDeclaration,
				showAddress: true,
				showEndAddress: false,
				bufferPointer: 0,
				displayFormat: 'decimal',
			} as unknown as MemoryIdentifier,
			elementByteSize: 1,
			inverseElementByteSize: 1,
			baseSampleShift: 0,
			length: 16,
			pointer: {
				memory: { allocationUnitAddress: 10 } as PlannedMemoryDeclaration,
				showAddress: false,
				showEndAddress: false,
				bufferPointer: 0,
				displayFormat: 'decimal',
			} as unknown as MemoryIdentifier,
			valueType: 'int8',
			minValue: -128,
			maxValue: 127,
			inverseValueRange: 1 / 255,
		});

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayWaves).toHaveLength(1);
	});

	it('adds a waveform-only wave when the pointer is omitted', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @wave bufferAddress 16']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayWaves).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayWaves[0].pointer).toBeUndefined();
	});

	it('renders wave2 at double height', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @wave2 bufferAddress 16 pointer1']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayWaves).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayWaves[0].height).toBe(64);
	});

	it('renders wave4 at quadruple height', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @wave4 bufferAddress 16 pointer1']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayWaves).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayWaves[0].height).toBe(128);
	});

	it('handles multiple wave directives', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @wave bufferAddress 16 pointer1', '; @wave &buffer2 len2 pointer2']);
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
		mockState.compiler.memoryPlan.modules['test-block']!.memory['buffer2Address'] = {
			allocationUnitAddress: 2,
			byteAddress: 8,
			numberOfElements: 1,
			elementWordSize: 4,
			type: 'int*' as const,
			allocationUnitCount: 1,
			default: 0,
			isInteger: true,
			id: 'buffer2Address',
			pointeeBaseType: 'int8',
			pointerDepth: 1,
		};
		mockState.compiler.memoryPlan.modules['test-block']!.memory['len2'] = {
			allocationUnitAddress: 15,
			byteAddress: 60,
			numberOfElements: 1,
			elementWordSize: 1,
			type: 'int' as const,
			allocationUnitCount: 1,
			default: 0,
			isInteger: true,
			id: 'len2',
			pointerDepth: 0,
		};
		mockState.compiler.memoryPlan.modules['test-block']!.memory['pointer2'] = {
			allocationUnitAddress: 20,
			byteAddress: 80,
			numberOfElements: 1,
			elementWordSize: 1,
			type: 'int' as const,
			allocationUnitCount: 1,
			default: 0,
			isInteger: true,
			id: 'pointer2',
			pointerDepth: 0,
		};

		setMockCodeBlockCode(mockGraphicData, ['; @wave &buffer1 16 pointer1', '; @wave buffer2Address len2 pointer2']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayWaves).toHaveLength(2);
	});

	it('does not add a wave when the length memory cannot be resolved', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @wave bufferAddress missingLength pointer1']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayWaves).toHaveLength(0);
	});

	it('resolves count() length expressions directly from the target memory', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @wave &buffer1 count(buffer1)']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayWaves).toHaveLength(1);
		expect(mockGraphicData.widgets.arrayWaves[0].length).toBe(16);
		expect(mockGraphicData.widgets.arrayWaves[0].pointer).toBeUndefined();
	});

	it('does not add a wave when the start memory does not encode element size', () => {
		mockState.compiler.memoryPlan.modules['test-block']!.memory['plainInt'] = {
			allocationUnitAddress: 30,
			byteAddress: 120,
			numberOfElements: 1,
			elementWordSize: 4,
			type: 'int' as const,
			allocationUnitCount: 1,
			default: 0,
			isInteger: true,
			id: 'plainInt',
			pointerDepth: 0,
		};
		setMockCodeBlockCode(mockGraphicData, ['; @wave plainInt 16 pointer1']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.arrayWaves).toHaveLength(0);
	});
});
