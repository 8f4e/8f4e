import type { EditorPlugin } from '@8f4e/editor-core';
import type { InternalPointerEvent, ViewportScrollEvent } from '@8f4e/editor-state-types';

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
		setup: ({ events }) => {
			let previousX = 0;
			let previousY = 0;

			function onMouseEvent(event: MouseEvent) {
				if (event.type === 'mousedown') {
					inputTarget.focus({ preventScroll: true });
				}

				const movementX = event.offsetX - previousX;
				const movementY = event.offsetY - previousY;
				previousX = event.offsetX;
				previousY = event.offsetY;

				const { offsetX, offsetY, buttons, altKey } = event;
				const type = POINTER_EVENTS[event.type as keyof typeof POINTER_EVENTS];

				event.preventDefault();

				const eventObject: InternalPointerEvent = {
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

				events.dispatch(type, eventObject);
			}

			function onWheelEvent(event: WheelEvent) {
				event.preventDefault();
				events.dispatch('viewportscroll', {
					deltaX: event.deltaX,
					deltaY: event.deltaY,
					stopPropagation: false,
				} satisfies ViewportScrollEvent);
			}

			if (captureWheel) {
				inputTarget.addEventListener('wheel', onWheelEvent, { passive: false });
			}
			inputTarget.addEventListener('mouseup', onMouseEvent);
			inputTarget.addEventListener('mousedown', onMouseEvent);
			inputTarget.addEventListener('mousemove', onMouseEvent);
			inputTarget.addEventListener('contextmenu', onMouseEvent);

			return () => {
				inputTarget.removeEventListener('wheel', onWheelEvent);
				inputTarget.removeEventListener('mouseup', onMouseEvent);
				inputTarget.removeEventListener('mousedown', onMouseEvent);
				inputTarget.removeEventListener('mousemove', onMouseEvent);
				inputTarget.removeEventListener('contextmenu', onMouseEvent);
			};
		},
	};
}
