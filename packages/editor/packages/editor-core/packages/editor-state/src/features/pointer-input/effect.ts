import type { CodeBlockPointerDownEvent, EventDispatcher, InternalPointerEvent, State } from '@8f4e/editor-state-types';
import { INPUT_LAYERS } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import findCodeBlockAtViewportCoordinates from '../code-blocks/utils/finders/findCodeBlockAtViewportCoordinates';

export default function pointerInput(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();
	const getBlockPointer = ({ x, y }: InternalPointerEvent): CodeBlockPointerDownEvent | undefined => {
		const codeBlock = findCodeBlockAtViewportCoordinates(state, x, y);
		if (!codeBlock) return;
		return {
			x,
			y,
			codeBlock,
			relativeX: x - (codeBlock.x - state.viewport.x),
			relativeY: y - (codeBlock.y - state.viewport.y),
			stopPropagation: false,
		};
	};
	const capturePointerDown = (event: InternalPointerEvent) => {
		// Probes must not activate overlays or reach controls beneath them.
		if (state.dialogStack.length > 0 || state.contextMenu.open) return;
		const pointer = getBlockPointer(event);
		if (!pointer) return;
		events.dispatch('codeBlockPointerDown', pointer, { phase: 'capture' });
		event.stopPropagation = pointer.stopPropagation;
	};
	const onPointerDown = (event: InternalPointerEvent) => {
		const pointer = getBlockPointer(event);
		if (pointer) events.dispatch('codeBlockPointerDown', pointer, { phase: 'normal' });
	};
	const onPointerMove = (event: InternalPointerEvent) => events.dispatch('codeBlockPointerMove', event);
	const releasePointer = () => events.dispatch('codeBlockPointerUp');

	// Controls claim input before default selection/dragging. Ordinary block listeners run after selection.
	events.on('pointerdown', capturePointerDown, { capture: true, layer: INPUT_LAYERS.codeBlock });
	events.on('pointerdown', onPointerDown);
	events.on('pointermove', onPointerMove, { capture: true, layer: INPUT_LAYERS.codeBlock });
	events.on('pointerup', releasePointer, { capture: true, layer: INPUT_LAYERS.codeBlock });
	events.on('pointercancel', releasePointer, { capture: true, layer: INPUT_LAYERS.codeBlock });
	return () => {
		events.off('pointerdown', capturePointerDown);
		events.off('pointerdown', onPointerDown);
		events.off('pointermove', onPointerMove);
		events.off('pointerup', releasePointer);
		events.off('pointercancel', releasePointer);
	};
}
