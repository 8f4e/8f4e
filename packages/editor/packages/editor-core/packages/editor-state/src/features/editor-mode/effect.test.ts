import { createMockState } from '@8f4e/editor-state-testing';
import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import editorMode from './effect';

describe('editorMode', () => {
	function setup(editorModeValue: State['editorMode'] = 'view', editing = false) {
		const handlers = new Map<string, (() => void)[]>();
		const state = createMockState({
			featureFlags: {
				editing,
				codeLineSelection: false,
			},
			editorMode: editorModeValue,
		});
		const store = {
			getState: () => state,
			set: vi.fn((path: string, value: unknown) => {
				if (path === 'editorMode') {
					state.editorMode = value as State['editorMode'];
				}
				if (path === 'featureFlags.editing') {
					state.featureFlags.editing = value as boolean;
				}
				if (path === 'featureFlags.codeLineSelection') {
					state.featureFlags.codeLineSelection = value as boolean;
				}
			}),
		} as unknown as StateManager<State>;
		const events = {
			on: vi.fn((name: string, callback: () => void) => {
				const group = handlers.get(name) ?? [];
				group.push(callback);
				handlers.set(name, group);
			}),
			off: vi.fn(),
			dispatch: vi.fn(),
		} as unknown as EventDispatcher;

		editorMode(store, events);

		return {
			state,
			store,
			emit(name: string) {
				handlers.get(name)?.forEach(callback => callback());
			},
		};
	}

	it('enters edit mode from view mode', () => {
		const { emit, state } = setup();

		emit('enterEditMode');

		expect(state.editorMode).toBe('edit');
		expect(state.featureFlags.editing).toBe(true);
		expect(state.featureFlags.codeLineSelection).toBe(true);
	});

	it('returns to view mode from edit mode', () => {
		const { emit, state } = setup('edit', true);

		emit('exitToViewMode');

		expect(state.editorMode).toBe('view');
		expect(state.featureFlags.editing).toBe(false);
		expect(state.featureFlags.codeLineSelection).toBe(true);
	});
});
