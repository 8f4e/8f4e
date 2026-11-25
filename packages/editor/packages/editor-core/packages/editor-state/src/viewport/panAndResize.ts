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

	function pan(deltaX: number, deltaY: number) {
		updateViewport(state, state.viewport.x + deltaX, state.viewport.y + deltaY, events, 'pan');
	}

	function onPointerMove(event: InternalPointerEvent) {
		if (event.buttons === 1) {
			pan(-event.movementX, -event.movementY);
		}
	}

	function onViewportScroll({ deltaX, deltaY }: ViewportScrollEvent) {
		pan(deltaX, deltaY);
	}

	function onResize(event: ResizeEvent) {
		resize(state, event.canvasWidth, event.canvasHeight);
	}

	events.on('pointermove', onPointerMove);
	events.on('viewportscroll', onViewportScroll);
	events.on('resize', onResize);

	return () => {
		events.off('pointermove', onPointerMove);
		events.off('viewportscroll', onViewportScroll);
		events.off('resize', onResize);
	};
}
