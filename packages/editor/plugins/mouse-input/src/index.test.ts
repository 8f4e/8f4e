import initState from '@8f4e/editor-state';
import { createMockEventDispatcher } from '@8f4e/editor-state-testing';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMouseInputPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.useRealTimers();
});
beforeEach(() => vi.useFakeTimers());

function setup(captureWheel = true, viewportDragging = true) {
	const inputTarget = Object.assign(new EventTarget(), {
		clientWidth: 640,
		clientHeight: 480,
		focus: vi.fn(),
		style: { getPropertyValue: () => '', getPropertyPriority: () => '', setProperty: vi.fn() },
	}) as unknown as HTMLElement;
	const events = { ...createMockEventDispatcher(), dispatch: vi.fn() };
	const store = initState(events, { callbacks: {}, featureFlags: { viewportDragging } });
	const dispose = createMouseInputPlugin({ inputTarget, captureWheel }).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		drawers: createEditorDrawerRegistry(),
	});
	events.dispatch.mockClear();
	cleanups.push(store.dispose, dispose);
	const mouse = (type: string, values = {}) => {
		const event = Object.assign(new Event(type, { cancelable: true }), {
			offsetX: 20,
			offsetY: 40,
			buttons: 1,
			altKey: false,
			...values,
		});
		inputTarget.dispatchEvent(event);
		return event;
	};
	const wheel = (deltaX = 3, deltaY = 5) => mouse('wheel', { deltaX, deltaY });
	return { store, events, inputTarget, mouse, wheel, dispose };
}

describe('mouse input', () => {
	it.each(['mousedown', 'mousemove', 'mouseup', 'contextmenu'])('forwards %s as a core input event', type => {
		const test = setup();
		expect(test.mouse(type).defaultPrevented).toBe(true);
		expect(test.events.dispatch).toHaveBeenCalledExactlyOnceWith(type, {
			x: 20,
			y: 40,
			movementX: 20,
			movementY: 40,
			buttons: 1,
			altKey: false,
			stopPropagation: false,
			canvasWidth: 640,
			canvasHeight: 480,
		});
	});

	it('tracks movement and focuses the owning canvas when pressed', () => {
		const test = setup();
		test.mouse('mousemove');
		test.mouse('mousedown', { offsetX: 28, offsetY: 56, altKey: true });
		expect(test.inputTarget.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
		expect(test.events.dispatch).toHaveBeenLastCalledWith(
			'mousedown',
			expect.objectContaining({ x: 28, y: 56, movementX: 8, movementY: 16, altKey: true })
		);
	});

	it('translates wheel movement and announces its end after scrolling pauses', () => {
		const test = setup();
		expect(test.wheel().defaultPrevented).toBe(true);
		expect(test.events.dispatch).toHaveBeenCalledWith(
			'mousemove',
			expect.objectContaining({ movementX: -3, movementY: -5, buttons: 1 })
		);
		vi.advanceTimersByTime(119);
		expect(test.events.dispatch).not.toHaveBeenCalledWith('viewportscrollend', expect.anything());
		vi.advanceTimersByTime(1);
		expect(test.events.dispatch).toHaveBeenLastCalledWith('viewportscrollend', { movementX: -3, movementY: -5 });
	});

	it('restarts the scroll-end timer with the latest movement', () => {
		const test = setup();
		test.wheel();
		vi.advanceTimersByTime(100);
		test.wheel(7, 9);
		vi.advanceTimersByTime(119);
		expect(test.events.dispatch).toHaveBeenCalledTimes(2);
		vi.advanceTimersByTime(1);
		expect(test.events.dispatch).toHaveBeenLastCalledWith('viewportscrollend', { movementX: -7, movementY: -9 });
	});

	it('leaves wheel input to the page when wheel capture is disabled', () => {
		const test = setup(false);
		expect(test.wheel().defaultPrevented).toBe(false);
		expect(test.events.dispatch).not.toHaveBeenCalled();
		test.mouse('mousedown');
		expect(test.events.dispatch).toHaveBeenCalledOnce();
	});

	it('honors viewport dragging changes without losing mouse input', () => {
		const test = setup(true, false);
		expect(test.wheel().defaultPrevented).toBe(false);
		test.store.set('featureFlags.viewportDragging', true);
		expect(test.wheel().defaultPrevented).toBe(true);
		test.store.set('featureFlags.viewportDragging', false);
		expect(test.wheel().defaultPrevented).toBe(false);
	});

	it('removes listeners and clears pending wheel work on disposal', () => {
		const test = setup();
		test.wheel();
		test.store.set('featureFlags.viewportDragging', false);
		test.dispose();
		vi.runAllTimers();
		test.mouse('mousedown');
		expect(test.wheel().defaultPrevented).toBe(false);
		expect(test.events.dispatch).toHaveBeenCalledOnce();
	});

	it('keeps movement history separate for each editor', () => {
		const first = setup();
		const second = setup();
		first.mouse('mousemove', { offsetX: 100, offsetY: 100 });
		second.mouse('mousemove');
		expect(second.events.dispatch).toHaveBeenLastCalledWith(
			'mousemove',
			expect.objectContaining({ movementX: 20, movementY: 40 })
		);
	});
});
