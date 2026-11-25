import type { EventDispatcher, InternalPointerEvent, State, ViewportScrollEvent } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import resize from './resize';
import updateViewport from './updateViewport';

interface ResizeEvent {
	canvasWidth: number;
	canvasHeight: number;
}

export default function registerViewportHandlers(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();

	function pan({ movementX, movementY }: ViewportScrollEvent) {
		updateViewport(state, state.viewport.x - movementX, state.viewport.y - movementY, events, 'pan');
	}

	function onPointerMove(event: InternalPointerEvent) {
		if (event.buttons === 1) {
			pan(event);
		}
	}

	function onResize(event: ResizeEvent) {
		resize(state, event.canvasWidth, event.canvasHeight);
	}

	events.on('pointermove', onPointerMove);
	events.on('viewportscroll', pan);
	events.on('resize', onResize);

	return () => {
		events.off('pointermove', onPointerMove);
		events.off('viewportscroll', pan);
		events.off('resize', onResize);
	};
}
