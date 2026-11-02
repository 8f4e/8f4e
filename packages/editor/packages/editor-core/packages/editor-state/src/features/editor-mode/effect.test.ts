import { EventEmitter } from 'node:events';
import { createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { afterEach, describe, expect, it } from 'vitest';
import editorMode from './effect';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('editorMode', () => {
	it.each([true, false])('preserves feature flags while switching modes (line selection: %s)', codeLineSelection => {
		const state = createMockState({ editorMode: 'view', featureFlags: { codeLineSelection } });
		const store = createStateManager(state);
		cleanups.push(store.dispose);
		const emitter = new EventEmitter();
		const events = {
			on: emitter.on.bind(emitter),
			off: emitter.off.bind(emitter),
			dispatch: emitter.emit.bind(emitter),
		};
		editorMode(store, events);
		const featureFlags = { ...state.featureFlags };

		events.dispatch('enterEditMode');
		expect(state.editorMode).toBe('edit');
		expect(state.featureFlags).toEqual(featureFlags);

		events.dispatch('exitToViewMode');
		expect(state.editorMode).toBe('view');
		expect(state.featureFlags).toEqual(featureFlags);
	});
});
