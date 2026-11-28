import initState from '@8f4e/editor-state';
import { createMockEventDispatcher } from '@8f4e/editor-state-testing';
import { createEditorRenderRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMouseInputPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(captureWheel = true) {
	const inputTarget = Object.assign(new EventTarget(), {
		clientWidth: 640,
		clientHeight: 480,
		focus: vi.fn(),
	}) as unknown as HTMLElement;
	const events = { ...createMockEventDispatcher(), dispatch: vi.fn() };
	const store = initState(events, { callbacks: {} });
	const dispose = createMouseInputPlugin({ inputTarget, captureWheel }).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		renderRegistry: createEditorRenderRegistry(),
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
	const wheel = (deltaX = 3, deltaY = 5, deltaMode = 0) => mouse('wheel', { deltaX, deltaY, deltaMode });
	return { events, inputTarget, mouse, wheel, dispose };
}

describe('mouse input', () => {
	it.each([
		['mousedown', 'pointerdown'],
		['mousemove', 'pointermove'],
		['mouseup', 'pointerup'],
		['contextmenu', 'contextmenu'],
	])('translates %s into %s', (type, translatedType) => {
		const test = setup();
		expect(test.mouse(type).defaultPrevented).toBe(true);
		expect(test.events.dispatch).toHaveBeenCalledExactlyOnceWith(translatedType, {
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
			'pointerdown',
			expect.objectContaining({ x: 28, y: 56, movementX: 8, movementY: 16, altKey: true })
		);
	});

	it.each([
		{ unit: 'pixels', mode: 0, deltaX: 3.5, deltaY: -5.25, expectedX: 3.5, expectedY: -5.25 },
		{ unit: 'lines', mode: 1, deltaX: -2, deltaY: 3, expectedX: -32, expectedY: 48 },
		{ unit: 'pages', mode: 2, deltaX: 1, deltaY: -0.5, expectedX: 640, expectedY: -240 },
	])(
		'normalizes signed wheel deltas in $unit for viewport scrolling',
		({ mode, deltaX, deltaY, expectedX, expectedY }) => {
			const test = setup();
			expect(test.wheel(deltaX, deltaY, mode).defaultPrevented).toBe(true);
			expect(test.events.dispatch).toHaveBeenCalledExactlyOnceWith('viewportscroll', {
				deltaX: expectedX,
				deltaY: expectedY,
				stopPropagation: false,
			});
		}
	);

	it('leaves wheel input to the page when wheel capture is disabled', () => {
		const test = setup(false);
		for (const mode of [0, 1, 2]) {
			expect(test.wheel(3, 5, mode).defaultPrevented).toBe(false);
		}
		expect(test.events.dispatch).not.toHaveBeenCalled();
		test.mouse('mousedown');
		expect(test.events.dispatch).toHaveBeenCalledOnce();
	});

	it('removes mouse and wheel listeners on disposal', () => {
		const test = setup();
		test.dispose();
		expect(test.mouse('mousedown').defaultPrevented).toBe(false);
		expect(test.wheel().defaultPrevented).toBe(false);
		expect(test.events.dispatch).not.toHaveBeenCalled();
	});

	it('keeps movement history separate for each editor', () => {
		const first = setup();
		const second = setup();
		first.mouse('mousemove', { offsetX: 100, offsetY: 100 });
		second.mouse('mousemove');
		expect(second.events.dispatch).toHaveBeenLastCalledWith(
			'pointermove',
			expect.objectContaining({ movementX: 20, movementY: 40 })
		);
	});
});
