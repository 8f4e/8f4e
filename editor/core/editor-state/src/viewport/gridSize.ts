import type { EventDispatcher, GridSize, State } from '@8f4e/editor-state-types';
import { resolvePendingProjectViewport } from './updateViewport';

/** A grid change is pending; continue using the previously installed dimensions until it resolves. */
export function markGridSizePending(state: State): void {
	state.gridSizeReady = false;
}

/** Mark the current installed grid ready and finish pending first-visit placement. Requires positive installed dimensions. */
export function settleGridSize(state: State, events: EventDispatcher): void {
	if (state.gridSizeReady) return;
	state.gridSizeReady = true;
	resolvePendingProjectViewport(state, events);
}

/** Install positive grid dimensions and synchronously settle layout and pending initial placement. */
export function setGridSize(state: State, events: EventDispatcher, { vGrid, hGrid }: GridSize): void {
	if (state.viewport.vGrid !== vGrid || state.viewport.hGrid !== hGrid) {
		markGridSizePending(state);
		state.viewport.vGrid = vGrid;
		state.viewport.hGrid = hGrid;
		events.dispatch('gridSizeChanged');
	}
	settleGridSize(state, events);
}
