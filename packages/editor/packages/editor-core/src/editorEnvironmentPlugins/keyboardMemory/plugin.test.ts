import { createMockState } from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import keyboardMemoryPlugin from './plugin';

type WindowListener = (event: KeyboardEvent) => void;

interface MockWindow {
	addEventListener: (type: string, listener: WindowListener) => void;
	removeEventListener: (type: string, listener: WindowListener) => void;
	emit: (type: string, event: KeyboardEvent) => void;
}

function createMockWindow(): MockWindow {
	const listeners = new Map<string, Set<WindowListener>>();

	return {
		addEventListener: (type: string, listener: WindowListener) => {
			const group = listeners.get(type) ?? new Set<WindowListener>();
			group.add(listener);
			listeners.set(type, group);
		},
		removeEventListener: (type: string, listener: WindowListener) => {
			const group = listeners.get(type);
			group?.delete(listener);
		},
		emit: (type: string, event: KeyboardEvent) => {
			const group = listeners.get(type);
			if (!group) {
				return;
			}
			for (const listener of group) {
				listener(event);
			}
		},
	};
}

function createKeyboardEventLike(code: string, key: string, keyCode: number): KeyboardEvent {
	return { code, key, keyCode } as KeyboardEvent;
}

function createMemoryPlan(
	memories: Record<string, { allocationUnitAddress: number }>
): State['compiler']['memoryPlan'] {
	const memory = Object.fromEntries(
		Object.entries(memories).map(([memoryId, memoryData]) => [
			memoryId,
			{
				id: memoryId,
				numberOfElements: 1,
				elementWordSize: 4,
				type: 'int' as const,
				byteAddress: memoryData.allocationUnitAddress * 4,
				elementByteLength: 4,
				allocationUnitCount: 1,
				allocatedByteLength: 4,
				allocationUnitAddress: memoryData.allocationUnitAddress,
				endByteAddress: memoryData.allocationUnitAddress * 4,
				endAddressSafeByteLength: 4,
				lineNumber: 1,
				isInteger: true,
				pointerDepth: 0,
				isUnsigned: false,
			},
		])
	);
	const keys = {
		id: 'keys',
		lineNumber: 1,
		byteAddress: 0,
		allocationUnitCount: Object.keys(memory).length,
		allocatedByteLength: Object.keys(memory).length * 4,
		endByteAddress: 0,
		endAddressSafeByteLength: 4,
		memory,
		declarations: Object.values(memory),
		declarationSources: [],
	};

	return {
		modules: { keys },
		moduleList: [keys],
	};
}

describe('keyboardMemoryPlugin', () => {
	let mockWindow: MockWindow;

	beforeEach(() => {
		mockWindow = createMockWindow();
	});

	it.each([false, true])('writes key values and tracks pressed keys through aliases=%s', exposed => {
		const setWordInMemory = vi.fn();
		const state = createMockState({
			editorConfig: {
				keyboard: {
					keyCodeMemory: 'keys:code',
					keyPressedMemory: 'keys:pressed',
				},
			},
			compiler: {
				projectMemoryExposuresByGroupPath: {},
				memoryPlan: createMemoryPlan({
					code: { allocationUnitAddress: 4 },
					pressed: { allocationUnitAddress: 5 },
				}),
			},
			callbacks: {
				setWordInMemory,
			},
		});

		if (exposed) {
			state.editorConfig.keyboard = { keyCodeMemory: 'keyboard:code', keyPressedMemory: 'keyboard:pressed' };
			state.compiler.projectMemoryExposuresByGroupPath.keyboard = ['code', 'pressed'].map(name => ({
				name,
				groupPath: 'keyboard',
				targetModuleId: 'keys',
				targetModuleName: 'keys',
				targetMemoryName: name,
				targetMemory: state.compiler.memoryPlan.modules.keys.memory[name],
			}));
		}

		const store = {
			getState: () => state,
		} as unknown as StateManager<State>;

		const cleanup = keyboardMemoryPlugin({
			store,
			events: {} as never,
			window: mockWindow as unknown as Window,
			navigator: {} as Navigator,
			inputTarget: mockWindow as unknown as HTMLElement,
			memoryViews: {} as never,
			services: {} as never,
			setErrors: () => {},
		});

		mockWindow.emit('keydown', createKeyboardEventLike('KeyA', 'a', 65));
		mockWindow.emit('keydown', createKeyboardEventLike('KeyB', 'b', 66));
		mockWindow.emit('keyup', createKeyboardEventLike('KeyB', 'b', 66));
		mockWindow.emit('keyup', createKeyboardEventLike('KeyA', 'a', 65));

		expect(setWordInMemory).toHaveBeenCalledWith(4, 4, true);
		expect(setWordInMemory).toHaveBeenCalledWith(5, 1, true);
		expect(setWordInMemory).toHaveBeenCalledWith(4, 5, true);
		expect(setWordInMemory).toHaveBeenCalledWith(4, 4, true);
		expect(setWordInMemory).toHaveBeenLastCalledWith(5, 0, true);

		cleanup();
	});

	it('clears pressed flag on blur and skips unresolved memory ids silently', () => {
		const setWordInMemory = vi.fn();
		const state = createMockState({
			editorConfig: {
				keyboard: {
					keyCodeMemory: 'missing:code',
					keyPressedMemory: 'keys:pressed',
				},
			},
			compiler: {
				projectMemoryExposuresByGroupPath: {},
				memoryPlan: createMemoryPlan({
					pressed: { allocationUnitAddress: 8 },
				}),
			},
			callbacks: {
				setWordInMemory,
			},
		});

		const store = {
			getState: () => state,
		} as unknown as StateManager<State>;

		const cleanup = keyboardMemoryPlugin({
			store,
			events: {} as never,
			window: mockWindow as unknown as Window,
			navigator: {} as Navigator,
			inputTarget: mockWindow as unknown as HTMLElement,
			memoryViews: {} as never,
			services: {} as never,
			setErrors: () => {},
		});

		mockWindow.emit('keydown', createKeyboardEventLike('Unidentified', 'c', 67));
		mockWindow.emit('blur', createKeyboardEventLike('', '', 0));

		expect(setWordInMemory).not.toHaveBeenCalledWith(undefined, expect.any(Number), true);
		expect(setWordInMemory).toHaveBeenCalledWith(8, 1, true);
		expect(setWordInMemory).toHaveBeenCalledWith(8, 0, true);
		expect(setWordInMemory).toHaveBeenLastCalledWith(8, 0, true);

		cleanup();
	});
});
