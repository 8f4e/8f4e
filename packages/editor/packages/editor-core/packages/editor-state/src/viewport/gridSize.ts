import type { EventDispatcher, GridSize, State } from '@8f4e/editor-state-types';
import { resolvePendingProjectViewport } from './updateViewport';

/** A grid change is pending; continue using the previously installed dimensions until it resolves. */
export function markGridSizePending(state: State): void {
	state.gridSizeReady = false;
}

/** Install positive grid dimensions and synchronously settle layout and pending initial placement. */
export function setGridSize(state: State, events: EventDispatcher, { vGrid, hGrid }: GridSize): void {
	const changed = state.viewport.vGrid !== vGrid || state.viewport.hGrid !== hGrid;
	const wasReady = state.gridSizeReady;
	if (changed) markGridSizePending(state);
	state.viewport.vGrid = vGrid;
	state.viewport.hGrid = hGrid;
	if (changed) events.dispatch('gridSizeChanged');
	state.gridSizeReady = true;
	if (changed || !wasReady) resolvePendingProjectViewport(state, events);
}
