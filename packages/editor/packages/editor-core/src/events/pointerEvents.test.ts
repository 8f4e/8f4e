import { createMockState } from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventDispatcher } from '.';
import pointerEvents from './pointerEvents';

type MouseLikeListener = (event: MouseEvent | WheelEvent) => void;

interface MockEventTarget {
	addEventListener: (type: string, listener: MouseLikeListener) => void;
	removeEventListener: (type: string, listener: MouseLikeListener) => void;
	emit: (type: string, event: MouseEvent | WheelEvent) => void;
}

function createMockEventTarget(): MockEventTarget {
	const listeners = new Map<string, Set<MouseLikeListener>>();

	return {
		addEventListener: (type, listener) => {
			const group = listeners.get(type) ?? new Set<MouseLikeListener>();
			group.add(listener);
			listeners.set(type, group);
		},
		removeEventListener: (type, listener) => {
			listeners.get(type)?.delete(listener);
		},
		emit: (type, event) => {
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

function createWheelEventLike(overrides: Partial<WheelEvent> = {}): WheelEvent {
	return {
		offsetX: 20,
		offsetY: 40,
		deltaX: 3,
		deltaY: 5,
		altKey: false,
		preventDefault: vi.fn(),
		...overrides,
	} as unknown as WheelEvent;
}

describe('pointerEvents', () => {
	let mockElement: MockEventTarget & Pick<HTMLElement, 'clientWidth' | 'clientHeight' | 'focus'>;
	let events: EventDispatcher;
	let state: State;

	beforeEach(() => {
		vi.useFakeTimers();
		mockElement = Object.assign(createMockEventTarget(), {
			clientWidth: 640,
			clientHeight: 480,
			focus: vi.fn(),
		});
		events = {
			on: vi.fn(),
			off: vi.fn(),
			dispatch: vi.fn(),
		};
		state = createMockState({
			featureFlags: {
				viewportDragging: true,
			},
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('dispatches mouseup after wheel scrolling has paused', () => {
		const cleanup = pointerEvents(mockElement as unknown as HTMLElement, events, state);
		const wheelEvent = createWheelEventLike();

		mockElement.emit('wheel', wheelEvent);

		expect(events.dispatch).toHaveBeenCalledWith('mousemove', {
			x: 20,
			y: 40,
			movementX: -3,
			movementY: -5,
			buttons: 1,
			stopPropagation: false,
			canvasWidth: 640,
			canvasHeight: 480,
			altKey: false,
		});
		expect(events.dispatch).not.toHaveBeenCalledWith('mouseup');

		vi.advanceTimersByTime(119);
		expect(events.dispatch).not.toHaveBeenCalledWith('viewportscrollend', expect.anything());

		vi.advanceTimersByTime(1);
		expect(events.dispatch).toHaveBeenCalledWith('viewportscrollend', {
			movementX: -3,
			movementY: -5,
		});

		cleanup();
	});

	it('resets the scroll-end timer on subsequent wheel events', () => {
		const cleanup = pointerEvents(mockElement as unknown as HTMLElement, events, state);

		mockElement.emit('wheel', createWheelEventLike());
		vi.advanceTimersByTime(100);
		mockElement.emit('wheel', createWheelEventLike({ deltaY: 7 }));

		vi.advanceTimersByTime(119);
		expect(events.dispatch).not.toHaveBeenCalledWith('viewportscrollend', expect.anything());

		vi.advanceTimersByTime(1);
		expect(events.dispatch).toHaveBeenCalledTimes(3);
		expect(events.dispatch).toHaveBeenLastCalledWith('viewportscrollend', {
			movementX: -3,
			movementY: -7,
		});

		cleanup();
	});

	it('leaves wheel events to the host when wheel capture is disabled', () => {
		const cleanup = pointerEvents(mockElement as unknown as HTMLElement, events, state, false);
		const wheelEvent = createWheelEventLike();

		mockElement.emit('wheel', wheelEvent);

		expect(wheelEvent.preventDefault).not.toHaveBeenCalled();
		expect(events.dispatch).not.toHaveBeenCalled();
		cleanup();
	});

	it('removes listeners and clears the pending timer during cleanup', () => {
		const cleanup = pointerEvents(mockElement as unknown as HTMLElement, events, state);

		mockElement.emit('wheel', createWheelEventLike());
		cleanup();
		vi.runAllTimers();

		expect(events.dispatch).toHaveBeenCalledTimes(1);

		mockElement.emit('wheel', createWheelEventLike());
		expect(events.dispatch).toHaveBeenCalledTimes(1);
	});

	it('focuses the owning canvas when it is pressed', () => {
		const cleanup = pointerEvents(mockElement as unknown as HTMLElement, events, state);
		const mouseEvent = {
			type: 'mousedown',
			offsetX: 10,
			offsetY: 20,
			buttons: 1,
			altKey: false,
			preventDefault: vi.fn(),
		} as unknown as MouseEvent;

		mockElement.emit('mousedown', mouseEvent);

		expect(mockElement.focus).toHaveBeenCalledWith({ preventScroll: true });
		cleanup();
	});
});
