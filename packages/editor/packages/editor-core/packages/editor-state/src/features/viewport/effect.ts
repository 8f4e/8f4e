import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { stopViewportAnimation } from './animateViewport';
import resize from './resize';
import snapToGrid from './snapToGrid';
import snapToGridConsideringDirection from './snapToGridConsideringDirection';
import updateViewport from './updateViewport';

interface MouseMoveEvent {
	buttons: number;
	movementX: number;
	movementY: number;
}

interface ResizeEvent {
	canvasWidth: number;
	canvasHeight: number;
}

interface ViewportScrollEvent {
	movementX: number;
	movementY: number;
}

interface ViewportScrollEndEvent {
	movementX: number;
	movementY: number;
}

export default function viewport(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();

	function onMouseMove(event: MouseMoveEvent) {
		if (event.buttons === 1 && state.featureFlags.viewportDragging) {
			updateViewport(state, state.viewport.x - event.movementX, state.viewport.y - event.movementY, events);
		}
	}

	function onResize(event: ResizeEvent) {
		resize(state, event.canvasWidth, event.canvasHeight);
		events.dispatch('viewportResized');
	}

	function onMouseUp() {
		const { x, y } = snapToGrid(state);
		updateViewport(state, x, y, events);
	}

	function onViewportScroll(event: ViewportScrollEvent) {
		if (!state.featureFlags.viewportDragging) return;
		updateViewport(state, state.viewport.x - event.movementX, state.viewport.y - event.movementY, events);
	}

	function onViewportScrollEnd(event: ViewportScrollEndEvent) {
		const { x, y } = snapToGridConsideringDirection(state, event);
		updateViewport(state, x, y, events);
	}

	events.on('mousemove', onMouseMove);
	events.on('resize', onResize);
	events.on('mouseup', onMouseUp);
	events.on('viewportscroll', onViewportScroll);
	events.on('viewportscrollend', onViewportScrollEnd);

	return () => {
		stopViewportAnimation(state);
		events.off('mousemove', onMouseMove);
		events.off('resize', onResize);
		events.off('mouseup', onMouseUp);
		events.off('viewportscroll', onViewportScroll);
		events.off('viewportscrollend', onViewportScrollEnd);
	};
}
