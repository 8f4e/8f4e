import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	createMockCodeBlock,
	createMockState,
	deriveDirectiveStateForMockCodeBlock,
	findWidgetById,
	setMockCodeBlockCode,
} from '~/pureHelpers/testingUtils/testUtils';
import { runBeforeGraphicDataWidthCalculation, runBlockLayoutReady } from '../registry';

describe('button directive widget resolution', () => {
	let mockGraphicData: CodeBlockGraphicData;
	let mockState: State;

	beforeEach(() => {
		mockGraphicData = createMockCodeBlock({
			name: 'test-block',
			code: ['; @button &btn1 0 1'],
			width: 100,
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
								btn1: {
									id: 'btn1',
									allocationUnitAddress: 5,
									isInteger: true,
								},
								btn2: {
									id: 'btn2',
									allocationUnitAddress: 6,
									isInteger: true,
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

	it('should add button to graphicData widgets', () => {
		runDirectiveResolution();

		expect(mockGraphicData.widgets.buttons.length).toBe(1);
		expect(findWidgetById(mockGraphicData.widgets.buttons, 'btn1')).toBeDefined();
	});

	it('should calculate correct dimensions and position', () => {
		runDirectiveResolution();

		const btn = findWidgetById(mockGraphicData.widgets.buttons, 'btn1');
		expect(btn).toMatchSnapshot();
	});

	it('should clear existing buttons before updating', () => {
		mockGraphicData.widgets.buttons.push({
			width: 0,
			height: 0,
			x: 0,
			y: 0,
			id: 'oldButton',
			allocationUnitAddress: 0,
			isInteger: true,
			onValue: 1,
			offValue: 0,
		});

		runDirectiveResolution();

		expect(findWidgetById(mockGraphicData.widgets.buttons, 'oldButton')).toBeUndefined();
	});

	it('should handle multiple buttons', () => {
		setMockCodeBlockCode(mockGraphicData, ['; @button &btn1 0 1', '; @button &btn2 5 10']);

		runDirectiveResolution();

		expect(mockGraphicData.widgets.buttons.length).toBe(2);
		expect(mockGraphicData.widgets.buttons).toMatchSnapshot();
	});

	it('should position buttons at correct y coordinate based on line number', () => {
		setMockCodeBlockCode(mockGraphicData, ['nop', 'nop', '; @button &btn1 0 1']);

		runDirectiveResolution();

		const btn = findWidgetById(mockGraphicData.widgets.buttons, 'btn1');
		expect(btn).toMatchSnapshot();
	});
});
