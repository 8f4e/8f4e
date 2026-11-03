import type { EditorPlugin } from '@8f4e/editor-core';
import type { InternalMouseEvent } from '@8f4e/editor-state-types';

const WHEEL_SCROLL_END_DELAY_MS = 120;

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
			let previousX = 0;
			let previousY = 0;
			let wheelScrollEndTimeout: ReturnType<typeof setTimeout> | undefined;

			function onMouseEvent(event: MouseEvent) {
				if (event.type === 'mousedown') {
					inputTarget.focus({ preventScroll: true });
				}

				const movementX = event.offsetX - previousX;
				const movementY = event.offsetY - previousY;
				previousX = event.offsetX;
				previousY = event.offsetY;

				const { offsetX, offsetY, type, buttons, altKey } = event;

				event.preventDefault();

				const eventObject = {
					x: offsetX,
					y: offsetY,
					movementX,
					movementY,
					buttons,
					stopPropagation: false,
					canvasWidth: inputTarget.clientWidth,
					canvasHeight: inputTarget.clientHeight,
					altKey,
				};

				events.dispatch<InternalMouseEvent>(type, eventObject);
			}

			function onWheelEvent(event: WheelEvent) {
				if (!state.featureFlags.viewportDragging) return;
				event.preventDefault();
				const movementX = event.deltaX * -1;
				const movementY = event.deltaY * -1;

				events.dispatch<InternalMouseEvent>('mousemove', {
					x: event.offsetX,
					y: event.offsetY,
					movementX,
					movementY,
					buttons: 1,
					stopPropagation: false,
					canvasWidth: inputTarget.clientWidth,
					canvasHeight: inputTarget.clientHeight,
					altKey: event.altKey,
				});

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
