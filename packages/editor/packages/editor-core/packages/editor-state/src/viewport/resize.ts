import type { State } from '@8f4e/editor-state-types';

export default function resize(state: State, width: number, height: number): void {
	state.viewport.width = width;
	state.viewport.height = height;
}
