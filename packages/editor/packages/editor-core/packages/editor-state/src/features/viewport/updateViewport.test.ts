import { describe, expect, it } from 'vitest';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import updateViewport from './updateViewport';

describe('updateViewport', () => {
	it('updates the viewport position and dispatches viewportChanged', () => {
		const state = createMockState({
			viewport: {
				x: 0,
				y: 0,
				width: 100,
				height: 60,
			},
		});
		const events = createMockEventDispatcherWithVitest();

		updateViewport(state, 24, 40, events);
		expect(state.viewport).toMatchObject({ x: 24, y: 40 });
		expect(events.dispatch).toHaveBeenCalledWith('viewportChanged', {
			previousX: 0,
			previousY: 0,
			x: 24,
			y: 40,
		});
	});

	it('does not dispatch movement events when the viewport position is unchanged', () => {
		const state = createMockState();
		const events = createMockEventDispatcherWithVitest();

		updateViewport(state, state.viewport.x, state.viewport.y, events);

		expect(events.dispatch).not.toHaveBeenCalled();
	});

	it('rounds fractional viewport coordinates before storing state and dispatching events', () => {
		const state = createMockState({
			viewport: {
				x: 0,
				y: 0,
				width: 100,
				height: 60,
			},
		});
		const events = createMockEventDispatcherWithVitest();

		updateViewport(state, 24.4, 39.6, events);

		expect(state.viewport.x).toBe(24);
		expect(state.viewport.y).toBe(40);
		expect(events.dispatch).toHaveBeenCalledWith('viewportChanged', {
			previousX: 0,
			previousY: 0,
			x: 24,
			y: 40,
		});
	});
});
