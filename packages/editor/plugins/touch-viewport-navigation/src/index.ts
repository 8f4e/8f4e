import type { EditorPlugin } from '@8f4e/editor-core';
import { snapToGrid, stopViewportAnimation, updateViewport } from '@8f4e/editor-state';

const DRAG_THRESHOLD = 6;

interface Gesture {
	identifier: number;
	startX: number;
	startY: number;
	startViewportX: number;
	startViewportY: number;
	dragging: boolean;
}

export function createTouchViewportNavigationPlugin({ inputTarget }: { inputTarget: HTMLElement }): EditorPlugin {
	return {
		id: 'touch-viewport-navigation',
		setup: ({ store, events }) => {
			const state = store.getState();
			const originalTouchAction = inputTarget.style.touchAction;
			let gesture: Gesture | undefined;
			const resetGesture = () => {
				gesture = undefined;
			};
			const finishGesture = () => {
				if (gesture?.dragging && state.featureFlags.viewportDragging) {
					const { x, y } = snapToGrid(state);
					updateViewport(state, x, y, events);
				}
				resetGesture();
			};
			const syncTouchAction = () => {
				inputTarget.style.touchAction = state.featureFlags.viewportDragging ? 'none' : originalTouchAction;
				if (!state.featureFlags.viewportDragging) resetGesture();
			};
			const onTouchStart = (event: TouchEvent) => {
				if (event.defaultPrevented || !state.featureFlags.viewportDragging) return;
				finishGesture();
				if (event.touches.length !== 1) return;
				const touch = event.touches[0];
				stopViewportAnimation(state);
				gesture = {
					identifier: touch.identifier,
					startX: touch.clientX,
					startY: touch.clientY,
					startViewportX: state.viewport.x,
					startViewportY: state.viewport.y,
					dragging: false,
				};
			};
			const onTouchMove = (event: TouchEvent) => {
				if (!gesture) return;
				if (event.touches.length !== 1 || event.defaultPrevented || !state.featureFlags.viewportDragging) {
					finishGesture();
					return;
				}
				const touch = event.touches[0];
				if (touch.identifier !== gesture.identifier) return;
				const deltaX = touch.clientX - gesture.startX;
				const deltaY = touch.clientY - gesture.startY;
				if (!gesture.dragging && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
				gesture.dragging = true;
				event.preventDefault();
				updateViewport(state, gesture.startViewportX - deltaX, gesture.startViewportY - deltaY, events);
			};
			const onTouchEnd = (event: TouchEvent) => {
				// Leave taps to the existing mouse-input bridge; a completed pan must not click a control.
				if (gesture?.dragging) event.preventDefault();
				finishGesture();
			};
			syncTouchAction();
			store.subscribe('featureFlags.viewportDragging', syncTouchAction);
			events.on('loadProject', resetGesture, { capture: true });
			inputTarget.addEventListener('touchstart', onTouchStart, { passive: true });
			inputTarget.addEventListener('touchmove', onTouchMove, { passive: false });
			inputTarget.addEventListener('touchend', onTouchEnd, { passive: false });
			inputTarget.addEventListener('touchcancel', finishGesture);
			return () => {
				inputTarget.removeEventListener('touchstart', onTouchStart);
				inputTarget.removeEventListener('touchmove', onTouchMove);
				inputTarget.removeEventListener('touchend', onTouchEnd);
				inputTarget.removeEventListener('touchcancel', finishGesture);
				store.unsubscribe('featureFlags.viewportDragging', syncTouchAction);
				events.off('loadProject', resetGesture);
				resetGesture();
				inputTarget.style.touchAction = originalTouchAction;
			};
		},
	};
}
