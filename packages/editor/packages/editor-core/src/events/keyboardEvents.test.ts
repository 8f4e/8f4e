import { createMockState } from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventDispatcher } from '.';
import keyboardEvents from './keyboardEvents';

type KeyboardListener = (event: KeyboardEvent) => void;

interface MockInputTarget {
	addEventListener: (type: string, listener: KeyboardListener) => void;
	removeEventListener: (type: string, listener: KeyboardListener) => void;
	emit: (type: string, event: KeyboardEvent) => void;
}

function createMockInputTarget(): MockInputTarget {
	const listeners = new Map<string, Set<KeyboardListener>>();

	return {
		addEventListener: (type: string, listener: KeyboardListener) => {
			const group = listeners.get(type) ?? new Set<KeyboardListener>();
			group.add(listener);
			listeners.set(type, group);
		},
		removeEventListener: (type: string, listener: KeyboardListener) => {
			listeners.get(type)?.delete(listener);
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

function createKeyboardEventLike(key: string): KeyboardEvent {
	return {
		key,
		preventDefault: vi.fn(),
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
	} as unknown as KeyboardEvent;
}

describe('keyboardEvents mode switching', () => {
	let inputTarget: MockInputTarget;
	let featureFlags: State['featureFlags'];
	let editorMode: State['editorMode'];
	let events: EventDispatcher;
	let store: StateManager<State>;

	beforeEach(() => {
		inputTarget = createMockInputTarget();

		featureFlags = {
			...createMockState().featureFlags,
			contextMenu: true,
			moduleDragging: true,
			codeLineSelection: false,
			viewportDragging: true,
			editing: false,
			modeToggling: true,
			historyTracking: true,
		};
		editorMode = 'view';
		events = {
			on: vi.fn(),
			off: vi.fn(),
			dispatch: vi.fn(),
		};

		store = {
			getState: () => createMockState({ featureFlags, editorMode }),
		} as unknown as StateManager<State>;
	});

	it('enters edit mode when e is pressed in view mode', () => {
		const cleanup = keyboardEvents(inputTarget as unknown as HTMLElement, events, store);
		const event = createKeyboardEventLike('e');

		inputTarget.emit('keydown', event);

		expect(events.dispatch).toHaveBeenCalledWith('enterEditMode');
		expect(event.preventDefault as ReturnType<typeof vi.fn>).toHaveBeenCalled();
		cleanup();
	});

	it.each(['view', 'edit'] as const)('dispatches modifier-arrow navigation in %s mode', mode => {
		editorMode = mode;
		featureFlags.modeToggling = false;
		const cleanup = keyboardEvents(inputTarget as unknown as HTMLElement, events, store);

		for (const modifier of ['metaKey', 'ctrlKey']) {
			for (const [key, direction] of [
				['ArrowLeft', 'left'],
				['ArrowRight', 'right'],
				['ArrowUp', 'up'],
				['ArrowDown', 'down'],
			]) {
				const event = createKeyboardEventLike(key);
				Object.assign(event, { [modifier]: true });
				inputTarget.emit('keydown', event);

				expect(events.dispatch).toHaveBeenLastCalledWith('navigateCodeBlock', { direction });
				expect(event.preventDefault).toHaveBeenCalledOnce();
			}
		}

		cleanup();
	});

	it('returns to view mode when Escape is pressed in edit mode', () => {
		editorMode = 'edit';
		const cleanup = keyboardEvents(inputTarget as unknown as HTMLElement, events, store);
		const event = createKeyboardEventLike('Escape');

		inputTarget.emit('keydown', event);

		expect(events.dispatch).toHaveBeenCalledWith('exitToViewMode');
		expect(event.preventDefault as ReturnType<typeof vi.fn>).toHaveBeenCalled();
		cleanup();
	});

	it('keeps i as text insertion while already in edit mode', () => {
		editorMode = 'edit';
		const cleanup = keyboardEvents(inputTarget as unknown as HTMLElement, events, store);
		const event = createKeyboardEventLike('i');

		inputTarget.emit('keydown', event);

		expect(events.dispatch).toHaveBeenCalledWith('insertText', { text: 'i' });
		cleanup();
	});

	it('does not enter edit mode when modeToggling is disabled', () => {
		featureFlags.modeToggling = false;
		const cleanup = keyboardEvents(inputTarget as unknown as HTMLElement, events, store);
		const enterEditEvent = createKeyboardEventLike('e');

		inputTarget.emit('keydown', enterEditEvent);

		expect(events.dispatch).not.toHaveBeenCalledWith('enterEditMode');
		cleanup();
	});

	it('does not leave edit mode when modeToggling is disabled', () => {
		featureFlags.modeToggling = false;
		editorMode = 'edit';
		const cleanup = keyboardEvents(inputTarget as unknown as HTMLElement, events, store);
		const event = createKeyboardEventLike('Escape');

		inputTarget.emit('keydown', event);

		expect(events.dispatch).not.toHaveBeenCalledWith('exitToViewMode');
		expect(event.preventDefault as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
		cleanup();
	});

	it('dispatches literal tab insertion when Tab is pressed', () => {
		editorMode = 'edit';
		const cleanup = keyboardEvents(inputTarget as unknown as HTMLElement, events, store);
		const event = createKeyboardEventLike('Tab');

		inputTarget.emit('keydown', event);

		expect(events.dispatch).toHaveBeenCalledWith('insertText', { text: '\t' });
		expect(event.preventDefault as ReturnType<typeof vi.fn>).toHaveBeenCalled();
		cleanup();
	});

	it('leaves Tab unhandled in view mode so focus can move to another editor', () => {
		const cleanup = keyboardEvents(inputTarget as unknown as HTMLElement, events, store);
		const event = createKeyboardEventLike('Tab');

		inputTarget.emit('keydown', event);

		expect(events.dispatch).not.toHaveBeenCalledWith('insertText', expect.anything());
		expect(event.preventDefault as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
		cleanup();
	});

	it('routes a key event only to the editor that owns its target', () => {
		editorMode = 'edit';
		const secondInputTarget = createMockInputTarget();
		const secondEvents = {
			on: vi.fn(),
			off: vi.fn(),
			dispatch: vi.fn(),
		};
		const cleanupFirst = keyboardEvents(inputTarget as unknown as HTMLElement, events, store);
		const cleanupSecond = keyboardEvents(secondInputTarget as unknown as HTMLElement, secondEvents, store);

		inputTarget.emit('keydown', createKeyboardEventLike('a'));

		expect(events.dispatch).toHaveBeenCalledWith('insertText', { text: 'a' });
		expect(secondEvents.dispatch).not.toHaveBeenCalled();

		secondInputTarget.emit('keydown', createKeyboardEventLike('b'));

		expect(secondEvents.dispatch).toHaveBeenCalledWith('insertText', { text: 'b' });
		cleanupFirst();
		cleanupSecond();
	});
});
