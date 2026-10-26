import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import sliderDefaultSaver from './effect';

function float32ToRawWord(value: number): number {
	const buffer = new ArrayBuffer(4);
	new Float32Array(buffer)[0] = value;
	return new Int32Array(buffer)[0];
}

describe('slider default saver', () => {
	let mockState: State;
	let mockStore: { getState: () => State; set: (path: string, value: unknown) => void };
	let mockEvents: EventDispatcher;
	let onCallbacks: Map<string, (...args: unknown[]) => void>;
	let offCallbacks: Map<string, (...args: unknown[]) => void>;

	beforeEach(() => {
		onCallbacks = new Map();
		offCallbacks = new Map();
		mockState = createMockState({
			callbacks: {
				getWordFromMemory: () => float32ToRawWord(0.75),
			},
		});
		mockStore = {
			getState: vi.fn(() => mockState),
			set: vi.fn(),
		};
		mockEvents = {
			on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
				onCallbacks.set(event, callback);
			}),
			off: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
				offCallbacks.set(event, callback);
			}),
		} as unknown as EventDispatcher;
	});

	it('registers and unregisters the save action', () => {
		const cleanup = sliderDefaultSaver(mockStore as any, mockEvents);

		expect(mockEvents.on).toHaveBeenCalledWith('saveSliderValuesToCode', expect.any(Function));

		cleanup();

		expect(mockEvents.off).toHaveBeenCalledWith('saveSliderValuesToCode', expect.any(Function));
	});

	it('saves runtime slider values back to code defaults', () => {
		sliderDefaultSaver(mockStore as any, mockEvents);
		const saveSliderValuesToCodeCallback = onCallbacks.get('saveSliderValuesToCode');
		const codeBlock = createMockCodeBlock({
			name: 'test-block',
			blockType: 'module',
			code: ['module test-block', 'float testSlider 0.25', '; @slider &testSlider 0 1 0.01', 'moduleEnd'],
		});
		codeBlock.widgets.sliders = [
			{
				moduleId: 'test-block',
				id: 'testSlider',
				x: 50,
				y: 50,
				width: 100,
				height: 20,
				allocationUnitAddress: 5,
				byteAddress: 20,
				isInteger: false,
				min: 0,
				max: 1,
				step: 0.01,
			},
		];

		mockState.codeBlockRendering.rootCodeBlocks.push(codeBlock);
		saveSliderValuesToCodeCallback?.({ codeBlock });

		expect(codeBlock.code).toEqual([
			'module test-block',
			'float testSlider 0.75',
			'; @slider &testSlider 0 1 0.01',
			'moduleEnd',
		]);
		expect(mockStore.set).toHaveBeenCalledWith('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', codeBlock);
	});
});
