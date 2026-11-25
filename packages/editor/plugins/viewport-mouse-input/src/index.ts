import type { EditorPlugin } from '@8f4e/editor-core';
import { createMouseInputPlugin } from '@8f4e/editor-plugin-mouse-input';
import type { InternalPointerEvent } from '@8f4e/editor-state-types';

/** Provides canvas mouse input with outside-canvas dragging on devices with a fine primary pointer. */
export function createViewportMouseInputPlugin({
	inputTarget: canvas,
	captureWheel,
}: {
	inputTarget: HTMLCanvasElement;
	captureWheel?: boolean;
}): EditorPlugin {
	const mouseInput = createMouseInputPlugin({ inputTarget: canvas, captureWheel });
	return {
		id: 'viewport-mouse-input',
		setup: context => {
			const browserWindow = canvas.ownerDocument.defaultView!;
			const hasFinePointer = browserWindow.matchMedia('(pointer: fine)').matches;
			const disposeMouseInput = mouseInput.setup(context);
			if (!hasFinePointer) return disposeMouseInput;

			const { events } = context;
			let pressedPointer: PointerEvent | undefined;

			const onPointerDown = (event: PointerEvent) => {
				if (!event.isTrusted || event.pointerType !== 'mouse' || event.button !== 0) return;
				// Keep native mousemove and mouseup targeted at the canvas. The shared mouse plugin still translates them.
				canvas.setPointerCapture(event.pointerId);
				pressedPointer = event;
			};
			const onPointerUp = (event: PointerEvent) => {
				// Normal release ends capture automatically and delivers a mouseup to the shared plugin.
				if (event.pointerId === pressedPointer?.pointerId) pressedPointer = undefined;
			};
			const releaseCapture = () => {
				const pointerId = pressedPointer?.pointerId;
				pressedPointer = undefined;
				if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
			};
			const finishInterruptedDrag = (event: PointerEvent) => {
				releaseCapture();
				const rect = canvas.getBoundingClientRect();
				events.dispatch('pointerup', {
					x: event.clientX - rect.left - canvas.clientLeft,
					y: event.clientY - rect.top - canvas.clientTop,
					movementX: 0,
					movementY: 0,
					buttons: 0,
					stopPropagation: false,
					canvasWidth: canvas.clientWidth,
					canvasHeight: canvas.clientHeight,
					altKey: event.altKey,
				} satisfies InternalPointerEvent);
			};
			const onLostPointerCapture = (event: PointerEvent) => {
				if (event.pointerId === pressedPointer?.pointerId) finishInterruptedDrag(event);
			};
			const onBlur = () => {
				if (pressedPointer) finishInterruptedDrag(pressedPointer);
			};

			canvas.addEventListener('pointerdown', onPointerDown);
			canvas.addEventListener('pointerup', onPointerUp);
			canvas.addEventListener('lostpointercapture', onLostPointerCapture);
			browserWindow.addEventListener('blur', onBlur);
			return () => {
				canvas.removeEventListener('pointerdown', onPointerDown);
				canvas.removeEventListener('pointerup', onPointerUp);
				canvas.removeEventListener('lostpointercapture', onLostPointerCapture);
				browserWindow.removeEventListener('blur', onBlur);
				disposeMouseInput();
				releaseCapture();
			};
		},
	};
}
