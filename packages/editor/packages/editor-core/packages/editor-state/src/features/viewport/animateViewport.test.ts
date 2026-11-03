import { describe, expect, it } from 'vitest';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import animateViewport, { advanceViewportAnimation, stopViewportAnimation } from './animateViewport';

describe('viewport animation', () => {
	it('waits for a render frame before updating viewport coordinates', () => {
		const state = createMockState();
		const events = createMockEventDispatcherWithVitest();

		animateViewport(state, 24, 40);

		expect(state.viewport).toMatchObject({ x: 0, y: 0 });
		expect(state.viewportAnimation).toMatchObject({ active: true, targetX: 24, targetY: 40 });

		advanceViewportAnimation(state, 1000, events);
		expect(state.viewport).toMatchObject({ x: 0, y: 0 });
		expect(events.dispatch).not.toHaveBeenCalled();

		advanceViewportAnimation(state, 1250, events);
		expect(state.viewport).toMatchObject({ x: 12, y: 20 });
		expect(state.viewport.center).toEqual({ x: 524, y: 404 });
		expect(events.dispatch).toHaveBeenCalledExactlyOnceWith('viewportChanged', {
			previousX: 0,
			previousY: 0,
			x: 12,
			y: 20,
		});
	});

	it('starts slow and reaches the midpoint halfway through the animation', () => {
		const state = createMockState();
		const events = createMockEventDispatcherWithVitest();
		animateViewport(state, 10, 10);

		advanceViewportAnimation(state, 0, events);
		advanceViewportAnimation(state, 125, events);
		expect(state.viewport).toMatchObject({ x: 1, y: 1 });

		advanceViewportAnimation(state, 250, events);
		expect(state.viewport).toMatchObject({ x: 5, y: 5 });
	});

	it('snaps to the exact target and leaves subsequent frames unchanged', () => {
		const state = createMockState();
		const events = createMockEventDispatcherWithVitest();
		animateViewport(state, 24, 40);
		advanceViewportAnimation(state, 0, events);
		advanceViewportAnimation(state, 600, events);

		expect(state.viewport).toMatchObject({ x: 24, y: 40 });
		expect(state.viewportAnimation.active).toBe(false);
		expect(state.viewportAnimation.startTime).toBeUndefined();

		events.dispatch.mockClear();
		advanceViewportAnimation(state, 800, events);
		expect(state.viewport).toMatchObject({ x: 24, y: 40 });
		expect(events.dispatch).not.toHaveBeenCalled();
	});

	it('retargets from the current animated coordinates', () => {
		const state = createMockState();
		const events = createMockEventDispatcherWithVitest();
		animateViewport(state, 100, 200);
		advanceViewportAnimation(state, 0, events);
		advanceViewportAnimation(state, 250, events);

		animateViewport(state, -50, 0);
		expect(state.viewport).toMatchObject({ x: 50, y: 100 });
		advanceViewportAnimation(state, 300, events);
		advanceViewportAnimation(state, 550, events);
		expect(state.viewport).toMatchObject({ x: 0, y: 50 });
		advanceViewportAnimation(state, 800, events);
		expect(state.viewport).toMatchObject({ x: -50, y: 0 });
		expect(state.viewportAnimation.active).toBe(false);
	});

	it('stops at the current position when cancelled', () => {
		const state = createMockState();
		const events = createMockEventDispatcherWithVitest();
		animateViewport(state, 100, 200);
		advanceViewportAnimation(state, 0, events);
		advanceViewportAnimation(state, 250, events);

		stopViewportAnimation(state);
		advanceViewportAnimation(state, 500, events);
		expect(state.viewport).toMatchObject({ x: 50, y: 100 });
		expect(state.viewportAnimation.active).toBe(false);
	});

	it('cancels an animation when retargeted to the current position', () => {
		const state = createMockState();
		const events = createMockEventDispatcherWithVitest();
		animateViewport(state, 100, 200);
		advanceViewportAnimation(state, 0, events);
		advanceViewportAnimation(state, 250, events);

		animateViewport(state, 50, 100);
		expect(state.viewportAnimation.active).toBe(false);
		advanceViewportAnimation(state, 500, events);
		expect(state.viewport).toMatchObject({ x: 50, y: 100 });
	});
});
