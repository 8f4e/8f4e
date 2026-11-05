import type { State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { afterEach, expect, it, vi } from 'vitest';
import createDefaultState from '../../pureHelpers/state/createDefaultState';
import { createLoadingRegistry } from './index';

afterEach(() => vi.restoreAllMocks());

it('retains terminal results and timestamps, replacing the same ID without accepting old completions', () => {
	const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
	const store = createStateManager<State>({ ...createDefaultState(), callbacks: {} });
	const loading = createLoadingRegistry(store);
	const changed = vi.fn();
	store.subscribe('loadingIndicators', changed);
	const first = loading.add({ id: 'compiler', message: 'Compiling...' });
	const other = loading.add({ id: 'asset', message: 'Fetching sound...' });
	now.mockReturnValue(1250);
	first.done();
	expect(store.getState().loadingIndicators[0]).toEqual({
		id: 'compiler',
		message: 'Compiling...',
		status: 'done',
		startedAt: 1000,
		finishedAt: 1250,
	});
	changed.mockClear();
	first.fail();
	first.cancel();
	expect(changed).not.toHaveBeenCalled();
	now.mockReturnValue(2000);
	const replacement = loading.add({ id: 'compiler', message: 'Compiling again...' });
	changed.mockClear();
	first.done();
	first.fail();
	expect(changed).not.toHaveBeenCalled();
	expect(store.getState().loadingIndicators).toMatchObject([
		{ id: 'compiler', message: 'Compiling again...', status: 'loading', startedAt: 2000, finishedAt: null },
		{ id: 'asset', status: 'loading' },
	]);
	now.mockReturnValue(2300);
	replacement.fail();
	other.done();
	expect(store.getState().loadingIndicators.map(({ status, finishedAt }) => ({ status, finishedAt }))).toEqual([
		{ status: 'failed', finishedAt: 2300 },
		{ status: 'done', finishedAt: 2300 },
	]);
	store.dispose();
});

it('copies input, replaces pending attempts by ID, and isolates cancellation between editors', () => {
	vi.spyOn(Date, 'now').mockReturnValue(1000);
	const first = createStateManager<State>({ ...createDefaultState(), callbacks: {} });
	const second = createStateManager<State>({ ...createDefaultState(), callbacks: {} });
	const loading = createLoadingRegistry(first);
	const input = { id: 'sample', message: 'Fetching sample...' };
	const old = loading.add(input);
	const current = loading.add(input);
	input.message = 'changed';
	old.cancel();
	expect(first.getState().loadingIndicators).toEqual([
		{ id: 'sample', message: 'Fetching sample...', status: 'loading', startedAt: 1000, finishedAt: null },
	]);
	current.cancel();
	current.done();
	expect(first.getState().loadingIndicators[0]).toMatchObject({ status: 'cancelled', finishedAt: 1000 });
	expect(second.getState().loadingIndicators).toEqual([]);
	first.dispose();
	second.dispose();
});
