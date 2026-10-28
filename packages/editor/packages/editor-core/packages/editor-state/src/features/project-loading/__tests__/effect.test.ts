import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import projectLoading from '../effect';
import { EMPTY_DEFAULT_PROJECT } from '../emptyDefaultProject';

describe('project loading', () => {
	it('loads explicit content and starts a new empty project through the same action', () => {
		const state = createMockState();
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		projectLoading(store, events);
		const project = { ...EMPTY_DEFAULT_PROJECT, notes: [{ id: 0, code: ['note test', 'noteEnd'] }] };
		const load = vi.mocked(events.on).mock.calls.find(([name]) => name === 'loadProject')![1];
		load({ project });
		expect(state.initialProjectState).toBe(project);
		vi.mocked(events.on).mock.calls.find(([name]) => name === 'new')![1](undefined);
		expect(events.dispatch).toHaveBeenCalledWith('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		store.dispose();
	});
});
