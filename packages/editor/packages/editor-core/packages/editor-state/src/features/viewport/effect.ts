import type { EventDispatcher, InternalPointerEvent, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import resize from './resize';
import updateViewport from './updateViewport';

interface ResizeEvent {
	canvasWidth: number;
	canvasHeight: number;
}

export default function viewport(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();

	function onPointerMove(event: InternalPointerEvent) {
		if (event.buttons === 1 && state.featureFlags.viewportDragging) {
			updateViewport(state, state.viewport.x - event.movementX, state.viewport.y - event.movementY, events, 'pan');
		}
	}

	function onResize(event: ResizeEvent) {
		resize(state, event.canvasWidth, event.canvasHeight);
	}

	events.on('pointermove', onPointerMove);
	events.on('resize', onResize);

	return () => {
		events.off('pointermove', onPointerMove);
		events.off('resize', onResize);
	};
}
