import createStateManager from '@8f4e/state-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '../../pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '../../pureHelpers/testingUtils/vitestTestUtils';
import { EMPTY_DEFAULT_PROJECT } from '../project-loading/emptyDefaultProject';
import historyTracking from './effect';

describe('history tracking effect', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('restores undo and redo snapshots within the current project', () => {
		const state = createMockState({ featureFlags: { historyTracking: true } });
		state.historyStack.push(EMPTY_DEFAULT_PROJECT);
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const dispose = historyTracking(store, events);
		vi.mocked(events.on).mock.calls.find(([name]) => name === 'undo')![1](undefined);
		expect(state.initialProjectState).toBe(EMPTY_DEFAULT_PROJECT);
		expect(state.redoStack).toHaveLength(1);
		const redoSnapshot = state.redoStack[0];
		vi.mocked(events.on).mock.calls.find(([name]) => name === 'redo')![1](undefined);
		expect(state.initialProjectState).toBe(redoSnapshot);
		expect(state.historyStack).toHaveLength(1);
		dispose?.();
	});

	it('cancels a pending history snapshot when disposed', async () => {
		const state = createMockState({
			featureFlags: { historyTracking: true },
		});
		state.codeBlockRendering.selectedCodeBlock = createMockCodeBlock({
			code: ['function main', 'functionEnd'],
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const dispose = historyTracking(store, events);

		store.set('codeBlockRendering.selectedCodeBlock.code', ['function main', 'functionEnd']);
		dispose?.();
		await vi.advanceTimersByTimeAsync(1000);

		expect(state.historyStack).toEqual([]);
	});
});
