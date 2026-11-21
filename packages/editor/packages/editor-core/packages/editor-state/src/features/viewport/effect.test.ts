import { EventEmitter } from 'node:events';
import type { EventDispatcher, InternalPointerEvent } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { expect, it, vi } from 'vitest';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';
import viewport from './effect';

it('keeps the final pixel position when a pan ends between grid lines', () => {
	const state = createMockState();
	const store = createStateManager(state);
	const emitter = new EventEmitter();
	const events: EventDispatcher = {
		on: emitter.on.bind(emitter),
		off: emitter.off.bind(emitter),
		dispatch: emitter.emit.bind(emitter),
	};
	const dispose = viewport(store, events);
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

	events.dispatch('pointermove', move);
	events.dispatch('pointerup', { ...move, buttons: 0, movementX: 0, movementY: 0 });

	expect(state.viewport).toMatchObject({ x: -5, y: 19 });
	expect(changed).toHaveBeenCalledExactlyOnceWith({ previousX: 0, previousY: 0, x: -5, y: 19, source: 'pan' });

	dispose();
	store.dispose();
});
