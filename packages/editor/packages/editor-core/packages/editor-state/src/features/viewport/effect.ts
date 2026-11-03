import type { EventDispatcher, InternalPointerEvent, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { stopViewportAnimation } from './animateViewport';
import resize from './resize';
import snapToGrid from './snapToGrid';
import snapToGridConsideringDirection from './snapToGridConsideringDirection';
import updateViewport from './updateViewport';

interface ResizeEvent {
	canvasWidth: number;
	canvasHeight: number;
}

interface ViewportScrollEndEvent {
	movementX: number;
	movementY: number;
}

export default function viewport(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();

	function onPointerMove(event: InternalPointerEvent) {
		if (event.buttons === 1 && state.featureFlags.viewportDragging) {
			updateViewport(state, state.viewport.x - event.movementX, state.viewport.y - event.movementY, events);
		}
	}

	function onResize(event: ResizeEvent) {
		resize(state, event.canvasWidth, event.canvasHeight);
		events.dispatch('viewportResized');
	}

	function onPointerUp() {
		const { x, y } = snapToGrid(state);
		updateViewport(state, x, y, events);
	}

	function onViewportScrollEnd(event: ViewportScrollEndEvent) {
		const { x, y } = snapToGridConsideringDirection(state, event);
		updateViewport(state, x, y, events);
	}

	events.on('pointermove', onPointerMove);
	events.on('resize', onResize);
	events.on('pointerup', onPointerUp);
	events.on('viewportscrollend', onViewportScrollEnd);

	return () => {
		stopViewportAnimation(state);
		events.off('pointermove', onPointerMove);
		events.off('resize', onResize);
		events.off('pointerup', onPointerUp);
		events.off('viewportscrollend', onViewportScrollEnd);
	};
}
