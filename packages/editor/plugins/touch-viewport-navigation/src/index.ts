import type { EditorPlugin } from '@8f4e/editor-core';
import {
	type CodeBlockPointerDownEvent,
	type CodeBlockPointerMoveEvent,
	findCodeBlockAtViewportCoordinates,
	snapToGrid,
	stopViewportAnimation,
	updateViewport,
} from '@8f4e/editor-state';

const DRAG_THRESHOLD = 6;

interface Gesture {
	startX: number;
	startY: number;
	startViewportX: number;
	startViewportY: number;
	dragging: boolean;
}

export interface TouchViewportNavigationOptions {
	inputTarget: HTMLElement;
	/** Number of fingers needed to pan. Defaults to two. */
	fingerCount?: 1 | 2;
	/** Disabled directions remain available to native page scrolling. Defaults to both. */
	axis?: 'both' | 'horizontal' | 'vertical';
}

function getTouchPosition(touches: TouchList): { x: number; y: number } {
	let x = 0;
	let y = 0;
	for (let i = 0; i < touches.length; i++) {
		x += touches[i].clientX;
		y += touches[i].clientY;
	}
	return { x: x / touches.length, y: y / touches.length };
}

export function createTouchViewportNavigationPlugin({
	inputTarget,
	fingerCount = 2,
	axis = 'both',
}: TouchViewportNavigationOptions): EditorPlugin {
	const horizontal = axis !== 'vertical';
	const vertical = axis !== 'horizontal';
	return {
		id: 'touch-viewport-navigation',
		setup: ({ store, events }) => {
			const state = store.getState();
			const originalTouchAction = inputTarget.style.touchAction;
			let gesture: Gesture | undefined;
			let controlPointer: { identifier: number } | undefined;
			const releaseControlPointer = () => {
				if (!controlPointer) return;
				controlPointer = undefined;
				events.dispatch('codeBlockPointerUp');
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
				inputTarget.style.touchAction = state.featureFlags.viewportDragging
					? axis === 'horizontal'
						? 'pan-y'
						: axis === 'vertical'
							? 'pan-x'
							: 'none'
					: originalTouchAction;
				if (!state.featureFlags.viewportDragging) resetGesture();
			};
			const onTouchStart = (event: TouchEvent) => {
				if (event.defaultPrevented) return;
				releaseControlPointer();
				finishGesture();
				if (event.touches.length === 1 && !state.contextMenu.open && state.dialogStack.length === 0) {
					const touch = event.touches[0];
					const rect = inputTarget.getBoundingClientRect();
					const x = touch.clientX - rect.left;
					const y = touch.clientY - rect.top;
					const codeBlock = findCodeBlockAtViewportCoordinates(state, x, y);
					if (codeBlock) {
						const pointerEvent: CodeBlockPointerDownEvent = {
							x,
							y,
							codeBlock,
							relativeX: x - (codeBlock.x - state.viewport.x),
							relativeY: y - (codeBlock.y - state.viewport.y),
							stopPropagation: false,
						};
						events.dispatch('codeBlockPointerDown', pointerEvent);
						if (pointerEvent.stopPropagation) {
							controlPointer = { identifier: touch.identifier };
							stopViewportAnimation(state);
							event.preventDefault();
							return;
						}
					}
				}
				if (!state.featureFlags.viewportDragging) return;
				if (event.touches.length !== fingerCount) return;
				const { x: startX, y: startY } = getTouchPosition(event.touches);
				stopViewportAnimation(state);
				gesture = {
					startX,
					startY,
					startViewportX: state.viewport.x,
					startViewportY: state.viewport.y,
					dragging: false,
				};
			};
			const onTouchMove = (event: TouchEvent) => {
				if (controlPointer) {
					if (event.defaultPrevented || state.contextMenu.open || state.dialogStack.length > 0) {
						releaseControlPointer();
						return;
					}
					const { identifier } = controlPointer;
					const touch = Array.from(event.touches).find(touch => touch.identifier === identifier);
					if (event.touches.length !== 1 || !touch) {
						releaseControlPointer();
						return;
					}
					const rect = inputTarget.getBoundingClientRect();
					const x = touch.clientX - rect.left;
					const y = touch.clientY - rect.top;
					event.preventDefault();
					events.dispatch<CodeBlockPointerMoveEvent>('codeBlockPointerMove', {
						x,
						y,
						stopPropagation: false,
					});
					return;
				}
				if (!gesture) return;
				if (event.touches.length !== fingerCount || event.defaultPrevented || !state.featureFlags.viewportDragging) {
					finishGesture();
					return;
				}
				const { x, y } = getTouchPosition(event.touches);
				const deltaX = x - gesture.startX;
				const deltaY = y - gesture.startY;
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
				// Leave taps to the existing mouse-input bridge; a completed pan must not click a control.
				if (gesture?.dragging || controlPointer) event.preventDefault();
				releaseControlPointer();
				finishGesture();
			};
			const onTouchCancel = () => {
				releaseControlPointer();
				finishGesture();
			};
			const onLoadProject = () => {
				releaseControlPointer();
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
				releaseControlPointer();
				resetGesture();
				inputTarget.style.touchAction = originalTouchAction;
			};
		},
	};
}
