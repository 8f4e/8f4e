import { type EventDispatcher, INPUT_LAYERS, type InternalPointerEvent, type State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { createCameraTransition } from './cameraTransition';

/** Own the presented viewport and the input and state subscriptions for navigation transitions. */
export function createCameraController(
	store: StateManager<State>,
	events: EventDispatcher,
	prefersReducedMotion = () => false
) {
	const state = store.getState();
	const viewport = { ...state.viewport };
	const frame = { viewport, suppressBlockOffsets: false };
	const transition = createCameraTransition(state.viewport);
	const { onViewportChanged, reset } = transition;
	const guardPointerPress = (event: InternalPointerEvent) => {
		if (transition.isTransitioning() && !prefersReducedMotion()) event.stopPropagation = true;
	};
	const inputGate = { capture: true, layer: INPUT_LAYERS.modalOverlay + 1 };
	events.on('viewportChanged', onViewportChanged);
	store.subscribe('project.activeLevel', reset);
	events.on('gridSizeChanged', reset);
	events.on('pointerdown', guardPointerPress, inputGate);
	events.on('contextmenu', guardPointerPress, inputGate);

	return {
		sample(frameTime: number) {
			const camera = transition.sample(state.viewport, frameTime, prefersReducedMotion());
			Object.assign(viewport, state.viewport);
			viewport.x = camera.x;
			viewport.y = camera.y;
			frame.suppressBlockOffsets = camera.suppressBlockOffsets;
			return frame;
		},
		destroy() {
			events.off('viewportChanged', onViewportChanged);
			store.unsubscribe('project.activeLevel', reset);
			events.off('gridSizeChanged', reset);
			events.off('pointerdown', guardPointerPress);
			events.off('contextmenu', guardPointerPress);
		},
	};
}
