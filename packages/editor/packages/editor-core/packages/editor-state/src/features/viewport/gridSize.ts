import type { EventDispatcher, GridSize, State } from '@8f4e/editor-state-types';

/** A grid change is pending; continue using the previously installed dimensions until it resolves. */
export function markGridSizePending(state: State): void {
	state.gridSizeReady = false;
}

/** Install positive grid dimensions, synchronously settle layout and notify readiness. */
export function setGridSize(state: State, events: EventDispatcher, { vGrid, hGrid }: GridSize): void {
	const changed = state.viewport.vGrid !== vGrid || state.viewport.hGrid !== hGrid;
	const wasReady = state.gridSizeReady;
	if (changed) markGridSizePending(state);
	state.viewport.vGrid = vGrid;
	state.viewport.hGrid = hGrid;
	if (changed) events.dispatch('gridSizeChanged');
	state.gridSizeReady = true;
	if (changed || !wasReady) events.dispatch('gridSizeReady');
}
