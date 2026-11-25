import { EventEmitter } from 'node:events';
import type { EventDispatcher, InternalPointerEvent, ViewportScrollEvent } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { expect, it, vi } from 'vitest';
import { createMockState } from '~/__tests__/helpers/mockEditorState';
import registerViewportHandlers from './panAndResize';

it.each(['pointermove', 'viewportscroll'] as const)('keeps the final pixel position after %s panning', input => {
	const state = createMockState();
	const store = createStateManager(state);
	const emitter = new EventEmitter();
	const events: EventDispatcher = {
		on: emitter.on.bind(emitter),
		off: emitter.off.bind(emitter),
		dispatch: emitter.emit.bind(emitter),
	};
	const dispose = registerViewportHandlers(store, events);
	const changed = vi.fn();
	events.on('viewportChanged', changed);
	const move: InternalPointerEvent = {
		x: 100,
		y: 100,
		movementX: 5,
		movementY: -19,
		buttons: 1,
		stopPropagation: false,
		canvasWidth: state.viewport.width,
		canvasHeight: state.viewport.height,
		altKey: false,
	};
	const scroll: ViewportScrollEvent = { deltaX: -5, deltaY: 19, stopPropagation: false };

	events.dispatch(input, input === 'pointermove' ? move : scroll);
	events.dispatch('pointerup', { ...move, buttons: 0, movementX: 0, movementY: 0 });

	expect(state.viewport).toMatchObject({ x: -5, y: 19 });
	expect(changed).toHaveBeenCalledExactlyOnceWith({ previousX: 0, previousY: 0, x: -5, y: 19, source: 'pan' });

	dispose();
	events.dispatch('viewportscroll', scroll);
	expect(state.viewport).toMatchObject({ x: -5, y: 19 });
	store.dispose();
});
