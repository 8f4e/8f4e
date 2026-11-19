import type { EditorPlugin } from '@8f4e/editor-core';
import type { InternalPointerEvent } from '@8f4e/editor-state-types';

const WHEEL_SCROLL_END_DELAY_MS = 120;
const POINTER_EVENTS = {
	mousedown: 'pointerdown',
	mousemove: 'pointermove',
	mouseup: 'pointerup',
	contextmenu: 'contextmenu',
} as const;

export function createMouseInputPlugin({
	inputTarget,
	captureWheel = true,
}: {
	inputTarget: HTMLElement;
	captureWheel?: boolean;
}): EditorPlugin {
	return {
		id: 'mouse-input',
		setup: ({ store, events }) => {
			const state = store.getState();
			const browserWindow = inputTarget.ownerDocument.defaultView;
			let previousX = 0;
			let previousY = 0;
			let trackingPress = false;
			let wheelScrollEndTimeout: ReturnType<typeof setTimeout> | undefined;

			function dispatchPointer(
				type: (typeof POINTER_EVENTS)[keyof typeof POINTER_EVENTS],
				x: number,
				y: number,
				buttons: number,
				altKey: boolean
			) {
				const pointer: InternalPointerEvent = {
					x,
					y,
					movementX: x - previousX,
					movementY: y - previousY,
					buttons,
					stopPropagation: false,
					canvasWidth: inputTarget.clientWidth,
					canvasHeight: inputTarget.clientHeight,
					altKey,
				};
				previousX = x;
				previousY = y;
				events.dispatch(type, pointer);
			}

			function startTrackingPress() {
				if (trackingPress) return;
				trackingPress = true;
				browserWindow?.addEventListener('mousemove', onMouseEvent, { capture: true });
				browserWindow?.addEventListener('mouseup', onMouseEvent, { capture: true });
				browserWindow?.addEventListener('blur', onWindowBlur);
			}

			function stopTrackingPress() {
				if (!trackingPress) return;
				trackingPress = false;
				browserWindow?.removeEventListener('mousemove', onMouseEvent, { capture: true });
				browserWindow?.removeEventListener('mouseup', onMouseEvent, { capture: true });
				browserWindow?.removeEventListener('blur', onWindowBlur);
			}

			function onWindowBlur() {
				stopTrackingPress();
				dispatchPointer('pointerup', previousX, previousY, 0, false);
			}

			function onMouseEvent(event: MouseEvent) {
				const onTarget = event.currentTarget === inputTarget;
				// Within the canvas, let the target listener process the event once.
				if (!onTarget && event.composedPath().includes(inputTarget)) return;
				let type = POINTER_EVENTS[event.type as keyof typeof POINTER_EVENTS];

				if (type === 'pointerdown') {
					if (event.buttons) startTrackingPress();
					inputTarget.focus({ preventScroll: true });
				} else if (type === 'pointermove') {
					// Ignore drags started elsewhere, and recover if the browser missed a release.
					if (!trackingPress && event.buttons) return;
					if (trackingPress && !event.buttons) type = 'pointerup';
				}
				if (type === 'pointerup') {
					if (!trackingPress) return;
					stopTrackingPress();
				}

				event.preventDefault();
				if (onTarget) {
					dispatchPointer(type, event.offsetX, event.offsetY, event.buttons, event.altKey);
				} else {
					const rect = inputTarget.getBoundingClientRect();
					const x = event.clientX - rect.left - inputTarget.clientLeft;
					const y = event.clientY - rect.top - inputTarget.clientTop;
					dispatchPointer(type, x, y, event.buttons, event.altKey);
				}
			}

			function onWheelEvent(event: WheelEvent) {
				if (!state.featureFlags.viewportDragging) return;
				event.preventDefault();
				const movementX = event.deltaX * -1;
				const movementY = event.deltaY * -1;

				events.dispatch('pointermove', {
					x: event.offsetX,
					y: event.offsetY,
					movementX,
					movementY,
					buttons: 1,
					stopPropagation: false,
					canvasWidth: inputTarget.clientWidth,
					canvasHeight: inputTarget.clientHeight,
					altKey: event.altKey,
				} satisfies InternalPointerEvent);

				if (wheelScrollEndTimeout) {
					clearTimeout(wheelScrollEndTimeout);
				}

				wheelScrollEndTimeout = setTimeout(() => {
					wheelScrollEndTimeout = undefined;
					events.dispatch('viewportscrollend', { movementX, movementY });
				}, WHEEL_SCROLL_END_DELAY_MS);
			}

			if (captureWheel) {
				inputTarget.addEventListener('wheel', onWheelEvent, { passive: false });
			}
			inputTarget.addEventListener('mouseup', onMouseEvent);
			inputTarget.addEventListener('mousedown', onMouseEvent);
			inputTarget.addEventListener('mousemove', onMouseEvent);
			inputTarget.addEventListener('contextmenu', onMouseEvent);

			return () => {
				stopTrackingPress();
				if (wheelScrollEndTimeout) {
					clearTimeout(wheelScrollEndTimeout);
				}

				inputTarget.removeEventListener('wheel', onWheelEvent);
				inputTarget.removeEventListener('mouseup', onMouseEvent);
				inputTarget.removeEventListener('mousedown', onMouseEvent);
				inputTarget.removeEventListener('mousemove', onMouseEvent);
				inputTarget.removeEventListener('contextmenu', onMouseEvent);
			};
		},
	};
}
