import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import crossfade from './interaction';

describe('crossfade interaction', () => {
	let mockState: State;
	let mockStore: { getState: () => State };
	let mockEvents: EventDispatcher;
	let onCallbacks: Map<string, (...args: unknown[]) => void>;
	let memoryStore: Map<number, number>;
	let setWordInMemory: (allocationUnitAddress: number, value: number, isInteger: boolean) => void;

	beforeEach(() => {
		onCallbacks = new Map();
		memoryStore = new Map();
		setWordInMemory = vi.fn((allocationUnitAddress: number, value: number) => {
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
								dry: {
									allocationUnitAddress: 5,
								},
								wet: {
									allocationUnitAddress: 6,
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
			off: vi.fn(),
		} as unknown as EventDispatcher;
	});

	function createCrossfadeCodeBlock() {
		const mockCodeBlock = createMockCodeBlock({
			name: 'test-block',
			x: 0,
			y: 0,
		});

		mockCodeBlock.widgets.crossfades = [
			{
				leftId: 'dry',
				rightId: 'wet',
				leftWordAddress: 5,
				rightWordAddress: 6,
				x: 50,
				y: 50,
				width: 100,
				height: 20,
				handleWidth: 10,
				trackWidth: 90,
				centerX: 45,
			},
		];

		return mockCodeBlock;
	}

	it('writes silence to both sides when clicked in the center', () => {
		const cleanup = crossfade(mockStore as any, mockEvents);
		const codeBlockPointerDownCallback = onCallbacks.get('codeBlockPointerDown');

		codeBlockPointerDownCallback?.({ x: 100, y: 60, codeBlock: createCrossfadeCodeBlock() });

		expect(memoryStore.get(5)).toBe(0.5);
		expect(memoryStore.get(6)).toBe(0.5);
		cleanup();
	});

	it('writes fully left when clicked on the left edge', () => {
		const cleanup = crossfade(mockStore as any, mockEvents);
		const codeBlockPointerDownCallback = onCallbacks.get('codeBlockPointerDown');

		codeBlockPointerDownCallback?.({ x: 50, y: 60, codeBlock: createCrossfadeCodeBlock() });

		expect(memoryStore.get(5)).toBe(1);
		expect(memoryStore.get(6)).toBe(0);
		cleanup();
	});

	it('updates both values during drag', () => {
		const cleanup = crossfade(mockStore as any, mockEvents);
		const codeBlockPointerDownCallback = onCallbacks.get('codeBlockPointerDown');
		const mouseMoveCallback = onCallbacks.get('mousemove');

		codeBlockPointerDownCallback?.({ x: 100, y: 60, codeBlock: createCrossfadeCodeBlock() });
		mouseMoveCallback?.({ x: 150, stopPropagation: false });

		expect(memoryStore.get(5)).toBe(0);
		expect(memoryStore.get(6)).toBe(1);
		cleanup();
	});

	it('stops updating when the mouse is released', () => {
		const cleanup = crossfade(mockStore as any, mockEvents);
		const codeBlockPointerDownCallback = onCallbacks.get('codeBlockPointerDown');
		const mouseMoveCallback = onCallbacks.get('mousemove');
		const mouseUpCallback = onCallbacks.get('mouseup');

		codeBlockPointerDownCallback?.({ x: 100, y: 60, codeBlock: createCrossfadeCodeBlock() });
		mouseUpCallback?.();
		mouseMoveCallback?.({ x: 150, stopPropagation: false });

		expect(setWordInMemory).toHaveBeenCalledTimes(2);
		cleanup();
	});
});
