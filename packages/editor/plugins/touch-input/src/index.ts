import type { EditorPlugin } from '@8f4e/editor-core';
import { snapToGrid, stopViewportAnimation, updateViewport } from '@8f4e/editor-state';
import type { InternalPointerEvent } from '@8f4e/editor-state-types';

const DRAG_THRESHOLD = 6;
const TOUCH_ACTION = { both: 'none', horizontal: 'pan-y', vertical: 'pan-x' } as const;

interface Gesture {
	startX: number;
	startY: number;
	startViewportX: number;
	startViewportY: number;
	dragging: boolean;
}

export interface TouchInputOptions {
	inputTarget: HTMLElement;
	/** Axes available for viewport panning. Defaults to both. */
	axis?: 'both' | 'horizontal' | 'vertical';
}

export function createTouchInputPlugin({ inputTarget, axis = 'both' }: TouchInputOptions): EditorPlugin {
	const horizontal = axis !== 'vertical';
	const vertical = axis !== 'horizontal';
	return {
		id: 'touch-input',
		setup: ({ store, events }) => {
			const state = store.getState();
			const originalTouchAction = inputTarget.style.touchAction;
			let gesture: Gesture | undefined;
			let claimedPointer: { identifier: number; event: InternalPointerEvent } | undefined;

			const toPointerEvent = (
				touch: Touch,
				event: TouchEvent,
				previous?: InternalPointerEvent
			): InternalPointerEvent => {
				const rect = inputTarget.getBoundingClientRect();
				const x = touch.clientX - rect.left;
				const y = touch.clientY - rect.top;
				return {
					x,
					y,
					movementX: previous ? x - previous.x : 0,
					movementY: previous ? y - previous.y : 0,
					buttons: 1,
					altKey: Boolean(event.altKey),
					stopPropagation: false,
					canvasWidth: inputTarget.clientWidth,
					canvasHeight: inputTarget.clientHeight,
				};
			};
			const releasePointer = (type: 'pointerup' | 'pointercancel' = 'pointerup') => {
				if (!claimedPointer) return;
				const { event } = claimedPointer;
				claimedPointer = undefined;
				events.dispatch(
					type,
					{ ...event, buttons: 0, movementX: 0, movementY: 0, stopPropagation: false },
					{ phase: 'capture' }
				);
			};
			const resetGesture = () => {
				gesture = undefined;
			};
			const finishGesture = () => {
				if (gesture?.dragging && state.featureFlags.viewportDragging) {
					const { x, y } = snapToGrid(state);
					updateViewport(state, horizontal ? x : state.viewport.x, vertical ? y : state.viewport.y, events);
				}
				resetGesture();
			};
			const syncTouchAction = () => {
				inputTarget.style.touchAction = state.featureFlags.viewportDragging ? TOUCH_ACTION[axis] : originalTouchAction;
				if (!state.featureFlags.viewportDragging) resetGesture();
			};
			const onTouchStart = (event: TouchEvent) => {
				if (event.defaultPrevented) return;
				releasePointer('pointercancel');
				finishGesture();
				if (event.touches.length !== 1) return;
				const touch = event.touches[0];
				const pointer = toPointerEvent(touch, event);
				// Probe shared interactions before committing this touch to a viewport gesture.
				events.dispatch('pointerdown', pointer, { phase: 'capture' });
				if (pointer.stopPropagation) {
					claimedPointer = { identifier: touch.identifier, event: pointer };
					stopViewportAnimation(state);
					event.preventDefault();
					return;
				}
				if (!state.featureFlags.viewportDragging) return;
				stopViewportAnimation(state);
				gesture = {
					startX: touch.clientX,
					startY: touch.clientY,
					startViewportX: state.viewport.x,
					startViewportY: state.viewport.y,
					dragging: false,
				};
			};
			const onTouchMove = (event: TouchEvent) => {
				if (claimedPointer) {
					const pointer = claimedPointer;
					const touch = Array.from(event.touches).find(touch => touch.identifier === pointer.identifier);
					if (event.defaultPrevented || event.touches.length !== 1 || !touch) {
						releasePointer('pointercancel');
						return;
					}
					event.preventDefault();
					pointer.event = toPointerEvent(touch, event, pointer.event);
					events.dispatch('pointermove', pointer.event, { phase: 'capture' });
					return;
				}
				if (!gesture) return;
				if (event.touches.length !== 1 || event.defaultPrevented || !state.featureFlags.viewportDragging) {
					finishGesture();
					return;
				}
				const touch = event.touches[0];
				const deltaX = touch.clientX - gesture.startX;
				const deltaY = touch.clientY - gesture.startY;
				if (!gesture.dragging) {
					if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
					if (
						(!vertical && Math.abs(deltaY) > Math.abs(deltaX)) ||
						(!horizontal && Math.abs(deltaX) > Math.abs(deltaY))
					) {
						resetGesture();
						return;
					}
				}
				gesture.dragging = true;
				event.preventDefault();
				updateViewport(
					state,
					gesture.startViewportX - (horizontal ? deltaX : 0),
					gesture.startViewportY - (vertical ? deltaY : 0),
					events
				);
			};
			const onTouchEnd = (event: TouchEvent) => {
				// Unclaimed taps retain native tap handling; completed gestures must not click twice.
				if (gesture?.dragging || claimedPointer) event.preventDefault();
				releasePointer();
				finishGesture();
			};
			const onTouchCancel = () => {
				releasePointer('pointercancel');
				finishGesture();
			};
			const onLoadProject = () => {
				releasePointer('pointercancel');
				resetGesture();
			};
			syncTouchAction();
			store.subscribe('featureFlags.viewportDragging', syncTouchAction);
			events.on('loadProject', onLoadProject, { capture: true });
			inputTarget.addEventListener('touchstart', onTouchStart, { passive: false });
			inputTarget.addEventListener('touchmove', onTouchMove, { passive: false });
			inputTarget.addEventListener('touchend', onTouchEnd, { passive: false });
			inputTarget.addEventListener('touchcancel', onTouchCancel);
			return () => {
				inputTarget.removeEventListener('touchstart', onTouchStart);
				inputTarget.removeEventListener('touchmove', onTouchMove);
				inputTarget.removeEventListener('touchend', onTouchEnd);
				inputTarget.removeEventListener('touchcancel', onTouchCancel);
				store.unsubscribe('featureFlags.viewportDragging', syncTouchAction);
				events.off('loadProject', onLoadProject);
				releasePointer('pointercancel');
				resetGesture();
				inputTarget.style.touchAction = originalTouchAction;
			};
		},
	};
}
