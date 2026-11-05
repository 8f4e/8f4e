import type { State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { expect, it, vi } from 'vitest';
import createDefaultState from '../../pureHelpers/state/createDefaultState';
import { createLoadingRegistry } from './index';

it('removes only its own object, even when names overlap or cleanup runs twice', () => {
	const store = createStateManager<State>({ ...createDefaultState(), callbacks: {} });
	const loading = createLoadingRegistry(store);
	const changed = vi.fn();
	store.subscribe('loadingIndicators', changed);
	const first = { name: 'sample' };
	const second = { name: 'sample' };
	const finishFirst = loading.add(first);
	const finishSecond = loading.add(second);
	finishFirst();
	expect(store.getState().loadingIndicators).toEqual([second]);
	expect(store.getState().loadingIndicators[0]).not.toBe(second);
	const replacement = { name: 'sample' };
	const finishReplacement = loading.add(replacement);
	changed.mockClear();
	finishFirst();
	expect(changed).not.toHaveBeenCalled();
	expect(store.getState().loadingIndicators).toEqual([second, replacement]);
	finishSecond();
	finishReplacement();
	expect(store.getState().loadingIndicators).toEqual([]);
	store.dispose();
});

it('keeps repeated registrations of the same input object independent and isolates editors', () => {
	const first = createStateManager<State>({ ...createDefaultState(), callbacks: {} });
	const second = createStateManager<State>({ ...createDefaultState(), callbacks: {} });
	const loading = createLoadingRegistry(first);
	const input = { name: 'sample' };
	const finishFirst = loading.add(input);
	const finishSecond = loading.add(input);
	input.name = 'changed';
	expect(first.getState().loadingIndicators).toEqual([{ name: 'sample' }, { name: 'sample' }]);
	finishFirst();
	expect(first.getState().loadingIndicators).toEqual([{ name: 'sample' }]);
	expect(second.getState().loadingIndicators).toEqual([]);
	finishSecond();
	first.dispose();
	second.dispose();
});
