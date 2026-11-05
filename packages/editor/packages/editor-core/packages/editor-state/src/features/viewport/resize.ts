import type { State } from '@8f4e/editor-state-types';

export default function resize(state: State, width: number, height: number): void {
	state.viewport.width = width;
	state.viewport.height = height;
	state.viewport.roundedWidth = Math.floor(width / state.viewport.vGrid) * state.viewport.vGrid;
	state.viewport.roundedHeight = Math.floor(height / state.viewport.hGrid) * state.viewport.hGrid;
}
