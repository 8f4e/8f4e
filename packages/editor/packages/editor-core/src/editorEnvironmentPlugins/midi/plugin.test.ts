import { createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import type { EditorEnvironmentPluginContext } from '../types';
import midiPlugin from './plugin';

function createContext(): EditorEnvironmentPluginContext {
	return {
		store: createStateManager(
			createMockState({
				info: {},
				codeBlockRendering: {
					codeBlocks: [],
				},
				compiler: {
					isCompiling: false,
				},
				editorConfig: {},
			})
		),
		events: {} as never,
		window: {} as Window,
		navigator: {} as Navigator,
		inputTarget: {} as HTMLElement,
		memoryViews: {} as never,
		services: {
			getWasmExports: vi.fn(),
		},
		setErrors: vi.fn(),
	};
}

describe('midiPlugin', () => {
	it('cleans up MIDI info and plugin-owned errors', () => {
		const context = createContext();
		const cleanup = midiPlugin(context);

		expect(context.store.getState().info.midi).toEqual({});

		cleanup();

		expect(context.store.getState().info.midi).toBeUndefined();
		expect(context.setErrors).toHaveBeenLastCalledWith([]);
	});
});
