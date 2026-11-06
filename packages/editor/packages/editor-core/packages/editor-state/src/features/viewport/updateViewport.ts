import type { EventDispatcher, State } from '@8f4e/editor-state-types';

/**
 * Applies viewport position updates through a single commit path.
 */
export default function updateViewport(state: State, x: number, y: number, events: EventDispatcher): boolean {
	const previousX = state.viewport.x;
	const previousY = state.viewport.y;
	const nextX = Math.round(x);
	const nextY = Math.round(y);

	state.viewport.x = nextX;
	state.viewport.y = nextY;

	const changed = state.viewport.x !== previousX || state.viewport.y !== previousY;

	if (changed) {
		const event = {
			previousX,
			previousY,
			x: state.viewport.x,
			y: state.viewport.y,
		};
		events.dispatch('viewportChanged', event);
	}

	return changed;
}
