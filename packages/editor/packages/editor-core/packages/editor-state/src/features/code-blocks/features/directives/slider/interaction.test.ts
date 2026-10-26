import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import slider from './interaction';

describe('slider interaction', () => {
	let mockState: State;
	let mockStore: { getState: () => State };
	let mockEvents: EventDispatcher;
	let onCallbacks: Map<string, (...args: unknown[]) => void>;
	let offCallbacks: Map<string, (...args: unknown[]) => void>;
	let memoryStore: Map<number, number>;
	let setWordInMemory: (allocationUnitAddress: number, value: number, isInteger: boolean) => void;

	beforeEach(() => {
		onCallbacks = new Map();
		offCallbacks = new Map();
		memoryStore = new Map();
		setWordInMemory = vi.fn((allocationUnitAddress: number, value: number, isInteger: boolean) => {
			void isInteger;
			memoryStore.set(allocationUnitAddress, value);
		});

		mockState = createMockState({
			viewport: {
				vGrid: 10,
				hGrid: 20,
				x: 0,
				y: 0,
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
								testSlider: {
									allocationUnitAddress: 5,
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
			callbacks: {
				setWordInMemory,
			},
		});

		mockStore = {
			getState: vi.fn(() => mockState),
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

	it('should register event listeners on initialization', () => {
		const cleanup = slider(mockStore as any, mockEvents);

		expect(mockEvents.on).toHaveBeenCalledWith('codeBlockPointerDown', expect.any(Function));
		expect(mockEvents.on).toHaveBeenCalledWith('mousemove', expect.any(Function));
		expect(mockEvents.on).toHaveBeenCalledWith('mouseup', expect.any(Function));

		cleanup();
	});

	it('should unregister event listeners on cleanup', () => {
		const cleanup = slider(mockStore as any, mockEvents);
		cleanup();

		expect(mockEvents.off).toHaveBeenCalledWith('codeBlockPointerDown', expect.any(Function));
		expect(mockEvents.off).toHaveBeenCalledWith('mousemove', expect.any(Function));
		expect(mockEvents.off).toHaveBeenCalledWith('mouseup', expect.any(Function));
	});

	it('should set value when slider is clicked', () => {
		const cleanup = slider(mockStore as any, mockEvents);
		const codeBlockPointerDownCallback = onCallbacks.get('codeBlockPointerDown');

		const mockCodeBlock = createMockCodeBlock({
			name: 'test-block',
			x: 0,
			y: 0,
		});
		mockCodeBlock.widgets.sliders = [
			{
				moduleId: 'test-block',
				id: 'testSlider',
				x: 50,
				y: 50,
				width: 100,
				height: 20,
				allocationUnitAddress: 5,
				byteAddress: 20,
				isInteger: true,
				min: 0,
				max: 100,
			},
		];

		// Click at 75% of slider width (should set value to 75)
		codeBlockPointerDownCallback?.({ x: 125, y: 60, codeBlock: mockCodeBlock });

		expect(setWordInMemory).toHaveBeenCalled();
		const setValue = memoryStore.get(5);
		expect(setValue).toBeCloseTo(75, 0);

		cleanup();
	});

	it('should clamp value to min when clicked at left edge', () => {
		const cleanup = slider(mockStore as any, mockEvents);
		const codeBlockPointerDownCallback = onCallbacks.get('codeBlockPointerDown');

		const mockCodeBlock = createMockCodeBlock({
			name: 'test-block',
			x: 0,
			y: 0,
		});
		mockCodeBlock.widgets.sliders = [
			{
				moduleId: 'test-block',
				id: 'testSlider',
				x: 50,
				y: 50,
				width: 100,
				height: 20,
				allocationUnitAddress: 5,
				byteAddress: 20,
				isInteger: true,
				min: 10,
				max: 100,
			},
		];

		// Click at left edge
		codeBlockPointerDownCallback?.({ x: 50, y: 60, codeBlock: mockCodeBlock });

		const setValue = memoryStore.get(5);
		expect(setValue).toBe(10);

		cleanup();
	});

	it('should clamp value to max when clicked at right edge', () => {
		const cleanup = slider(mockStore as any, mockEvents);
		const codeBlockPointerDownCallback = onCallbacks.get('codeBlockPointerDown');

		const mockCodeBlock = createMockCodeBlock({
			name: 'test-block',
			x: 0,
			y: 0,
		});
		mockCodeBlock.widgets.sliders = [
			{
				moduleId: 'test-block',
				id: 'testSlider',
				x: 50,
				y: 50,
				width: 100,
				height: 20,
				allocationUnitAddress: 5,
				byteAddress: 20,
				isInteger: true,
				min: 0,
				max: 100,
			},
		];

		// Click at right edge
		codeBlockPointerDownCallback?.({ x: 150, y: 60, codeBlock: mockCodeBlock });

		const setValue = memoryStore.get(5);
		expect(setValue).toBe(100);

		cleanup();
	});

	it('should snap to step value when step is provided', () => {
		const cleanup = slider(mockStore as any, mockEvents);
		const codeBlockPointerDownCallback = onCallbacks.get('codeBlockPointerDown');

		const mockCodeBlock = createMockCodeBlock({
			name: 'test-block',
			x: 0,
			y: 0,
		});
		mockCodeBlock.widgets.sliders = [
			{
				moduleId: 'test-block',
				id: 'testSlider',
				x: 50,
				y: 50,
				width: 100,
				height: 20,
				allocationUnitAddress: 5,
				byteAddress: 20,
				isInteger: true,
				min: 0,
				max: 100,
				step: 10,
			},
		];

		// Click at 47% (should snap to 50)
		codeBlockPointerDownCallback?.({ x: 97, y: 60, codeBlock: mockCodeBlock });

		const setValue = memoryStore.get(5);
		expect(setValue).toBe(50);

		cleanup();
	});

	it('should update value during drag', () => {
		const cleanup = slider(mockStore as any, mockEvents);
		const codeBlockPointerDownCallback = onCallbacks.get('codeBlockPointerDown');
		const mouseMoveCallback = onCallbacks.get('mousemove');

		const mockCodeBlock = createMockCodeBlock({
			name: 'test-block',
			x: 0,
			y: 0,
		});
		mockCodeBlock.widgets.sliders = [
			{
				moduleId: 'test-block',
				id: 'testSlider',
				x: 50,
				y: 50,
				width: 100,
				height: 20,
				allocationUnitAddress: 5,
				byteAddress: 20,
				isInteger: true,
				min: 0,
				max: 100,
			},
		];

		// Click to start drag
		codeBlockPointerDownCallback?.({ x: 100, y: 60, codeBlock: mockCodeBlock });
		expect(setWordInMemory).toHaveBeenCalled();

		// Move mouse to drag
		mouseMoveCallback?.({ x: 125, stopPropagation: false });

		expect(setWordInMemory).toHaveBeenCalledTimes(2);
		const setValue = memoryStore.get(5);
		expect(setValue).toBeCloseTo(75, 0);

		cleanup();
	});

	it('should stop updating when mouse is released', () => {
		const cleanup = slider(mockStore as any, mockEvents);
		const codeBlockPointerDownCallback = onCallbacks.get('codeBlockPointerDown');
		const mouseMoveCallback = onCallbacks.get('mousemove');
		const mouseUpCallback = onCallbacks.get('mouseup');

		const mockCodeBlock = createMockCodeBlock({
			name: 'test-block',
			x: 0,
			y: 0,
		});
		mockCodeBlock.widgets.sliders = [
			{
				moduleId: 'test-block',
				id: 'testSlider',
				x: 50,
				y: 50,
				width: 100,
				height: 20,
				allocationUnitAddress: 5,
				byteAddress: 20,
				isInteger: true,
				min: 0,
				max: 100,
			},
		];

		// Click to start drag
		codeBlockPointerDownCallback?.({ x: 100, y: 60, codeBlock: mockCodeBlock });

		// Release mouse
		mouseUpCallback?.();

		// Move mouse after release (should not update)
		const callCountBeforeMove = setWordInMemory.mock.calls.length;
		mouseMoveCallback?.({ x: 125, stopPropagation: false });
		const callCountAfterMove = setWordInMemory.mock.calls.length;

		expect(callCountAfterMove).toBe(callCountBeforeMove);

		cleanup();
	});
});
