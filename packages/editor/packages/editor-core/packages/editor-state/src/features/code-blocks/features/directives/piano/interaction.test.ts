import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import pianoKeyboard from './interaction';

describe('pianoKeyboard interaction', () => {
	let mockStore: StateManager<State>;
	let mockEvents: EventDispatcher;
	let mockState: State;
	let onCallbacks: Map<string, (...args: unknown[]) => void>;
	let memoryStore: Map<number, number>;

	beforeEach(() => {
		onCallbacks = new Map();
		memoryStore = new Map();

		mockState = createMockState({
			codeBlockRendering: {
				viewport: {
					vGrid: 10,
					hGrid: 20,
					x: 0,
					y: 0,
				},
			},
			callbacks: {
				getWordFromMemory: vi.fn((allocationUnitAddress: number) => memoryStore.get(allocationUnitAddress) ?? 0),
				setWordInMemory: vi.fn((allocationUnitAddress: number, value: number, isInteger: boolean) => {
					memoryStore.set(
						allocationUnitAddress,
						isInteger ? value : new Int32Array(new Float32Array([value]).buffer)[0]
					);
				}),
			},
		});

		mockStore = {
			getState: vi.fn(() => mockState),
			set: vi.fn(),
		} as unknown as StateManager<State>;

		mockEvents = {
			on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
				onCallbacks.set(event, callback);
			}),
			off: vi.fn(),
		} as unknown as EventDispatcher;
	});

	function createCodeBlockWithPiano() {
		const codeBlock = createMockCodeBlock({
			x: 100,
			y: 50,
			code: ['module test-block', 'int[] notes 10', 'int noteCount 0', '; @piano &notes &noteCount 48', 'moduleEnd'],
		});
		codeBlock.widgets.pianoKeyboards = [
			{
				pressedKeysListModuleId: 'test-block',
				pressedNumberOfKeysModuleId: 'test-block',
				x: 20,
				y: 40,
				width: 240,
				height: 100,
				keyWidth: 10,
				keyY: 20,
				keyHeight: 80,
				blackKeyHeight: 40,
				blackKeySideY: 60,
				blackKeySideHeight: 40,
				blackKeyGapXOffset: 3.75,
				blackKeyGapY: 60,
				blackKeyGapWidth: 2.5,
				blackKeyGapHeight: 40,
				lineNumber: 3,
				keys: Array.from({ length: 24 }, (_, offset) => ({
					offset,
					x: offset * 10,
					label: 'C',
					labelX: offset * 10,
					labelY: 0,
					kind: 'white',
					sprite: 'pianoKeyWhite',
					pressedOverlayX: offset * 10,
					pressedOverlayRows: [],
					pressedOverlayFont: 'fontPianoKeyWhitePressedOverlay',
				})),
				pressedKeysListMemory: {
					id: 'notes',
					allocationUnitAddress: 5,
					allocationUnitCount: 10,
					numberOfElements: 10,
					isInteger: true,
				},
				pressedNumberOfKeysMemory: {
					id: 'noteCount',
					allocationUnitAddress: 20,
					allocationUnitCount: 1,
					numberOfElements: 1,
					isInteger: true,
				},
				startingNumber: 48,
			},
		] as never;

		return codeBlock;
	}

	function clickKey(codeBlock: ReturnType<typeof createCodeBlockWithPiano>, keyOffset: number) {
		onCallbacks.get('codeBlockPointerDown')?.({
			x: 100 + 20 + keyOffset * 10 + 1,
			y: 50 + 40 + 1,
			codeBlock,
		});
	}

	it('registers event listeners on initialization', () => {
		const cleanup = pianoKeyboard(mockStore, mockEvents);

		expect(mockEvents.on).toHaveBeenCalledWith('codeBlockPointerDown', expect.any(Function));

		cleanup();
	});

	it('unregisters event listeners on cleanup', () => {
		const cleanup = pianoKeyboard(mockStore, mockEvents);
		cleanup();

		expect(mockEvents.off).toHaveBeenCalledWith('codeBlockPointerDown', expect.any(Function));
	});

	it('adds a clicked note directly to runtime memory without editing code', () => {
		const codeBlock = createCodeBlockWithPiano();
		const originalCode = [...codeBlock.code];
		const cleanup = pianoKeyboard(mockStore, mockEvents);

		clickKey(codeBlock, 2);

		expect(memoryStore.get(5)).toBe(50);
		expect(memoryStore.get(20)).toBe(1);
		expect(mockState.callbacks.setWordInMemory).toHaveBeenLastCalledWith(20, 1, true);
		expect(codeBlock.code).toEqual(originalCode);
		expect(mockStore.set).not.toHaveBeenCalled();
		cleanup();
	});

	it('removes a clicked note and compacts the remaining runtime notes', () => {
		const codeBlock = createCodeBlockWithPiano();
		memoryStore.set(20, 3);
		memoryStore.set(5, 48);
		memoryStore.set(6, 50);
		memoryStore.set(7, 52);
		const cleanup = pianoKeyboard(mockStore, mockEvents);

		clickKey(codeBlock, 2);

		expect(memoryStore.get(5)).toBe(48);
		expect(memoryStore.get(6)).toBe(52);
		expect(memoryStore.get(20)).toBe(2);
		expect(mockStore.set).not.toHaveBeenCalled();
		cleanup();
	});

	it('reads current runtime memory on each click', () => {
		const codeBlock = createCodeBlockWithPiano();
		const cleanup = pianoKeyboard(mockStore, mockEvents);

		clickKey(codeBlock, 2);
		clickKey(codeBlock, 4);
		expect(memoryStore.get(5)).toBe(50);
		expect(memoryStore.get(6)).toBe(52);
		expect(memoryStore.get(20)).toBe(2);

		clickKey(codeBlock, 2);
		clickKey(codeBlock, 4);
		expect(memoryStore.get(20)).toBe(0);
		cleanup();
	});

	it('preserves notes written by the runtime outside the visible keyboard range', () => {
		const codeBlock = createCodeBlockWithPiano();
		memoryStore.set(20, 2);
		memoryStore.set(5, 36);
		memoryStore.set(6, 84);
		const cleanup = pianoKeyboard(mockStore, mockEvents);

		clickKey(codeBlock, 2);

		expect(memoryStore.get(5)).toBe(36);
		expect(memoryStore.get(6)).toBe(84);
		expect(memoryStore.get(7)).toBe(50);
		expect(memoryStore.get(20)).toBe(3);
		cleanup();
	});

	it('does not add notes when the runtime array is full', () => {
		const codeBlock = createCodeBlockWithPiano();
		codeBlock.widgets.pianoKeyboards[0].pressedKeysListMemory.numberOfElements = 1;
		memoryStore.set(20, 1);
		memoryStore.set(5, 36);
		const cleanup = pianoKeyboard(mockStore, mockEvents);

		clickKey(codeBlock, 2);

		expect(mockState.callbacks.setWordInMemory).not.toHaveBeenCalled();
		cleanup();
	});

	it('allows removing a note when the runtime array is full', () => {
		const codeBlock = createCodeBlockWithPiano();
		codeBlock.widgets.pianoKeyboards[0].pressedKeysListMemory.numberOfElements = 1;
		memoryStore.set(20, 1);
		memoryStore.set(5, 50);
		const cleanup = pianoKeyboard(mockStore, mockEvents);

		clickKey(codeBlock, 2);

		expect(memoryStore.get(20)).toBe(0);
		cleanup();
	});

	it('decodes and writes float32 note arrays through the memory callbacks', () => {
		const codeBlock = createCodeBlockWithPiano();
		codeBlock.widgets.pianoKeyboards[0].pressedKeysListMemory.isInteger = false;
		memoryStore.set(20, 1);
		memoryStore.set(5, new Int32Array(new Float32Array([48]).buffer)[0]);
		const cleanup = pianoKeyboard(mockStore, mockEvents);

		clickKey(codeBlock, 2);

		expect(mockState.callbacks.setWordInMemory).toHaveBeenCalledWith(5, 48, false);
		expect(mockState.callbacks.setWordInMemory).toHaveBeenCalledWith(6, 50, false);
		expect(memoryStore.get(20)).toBe(2);

		clickKey(codeBlock, 2);
		expect(memoryStore.get(20)).toBe(1);
		cleanup();
	});

	it.each(['getWordFromMemory', 'setWordInMemory'] as const)('ignores clicks without %s', callback => {
		const codeBlock = createCodeBlockWithPiano();
		mockState.callbacks[callback] = undefined;
		const cleanup = pianoKeyboard(mockStore, mockEvents);

		clickKey(codeBlock, 2);

		expect(memoryStore.size).toBe(0);
		expect(mockStore.set).not.toHaveBeenCalled();
		cleanup();
	});
});
