import type { State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { expect, it, vi } from 'vitest';
import createDefaultState from '../../pureHelpers/state/createDefaultState';
import { addLoadingIndicator } from './index';

it('removes only its own object, even when names overlap or cleanup runs twice', () => {
	const store = createStateManager<State>({ ...createDefaultState(), callbacks: {} });
	const changed = vi.fn();
	store.subscribe('loadingIndicators', changed);
	const first = { name: 'sample' };
	const second = { name: 'sample' };
	const finishFirst = addLoadingIndicator(store, first);
	const finishSecond = addLoadingIndicator(store, second);
	finishFirst();
	expect(store.getState().loadingIndicators).toEqual([second]);
	expect(store.getState().loadingIndicators[0]).toBe(second);
	const replacement = { name: 'sample' };
	const finishReplacement = addLoadingIndicator(store, replacement);
	changed.mockClear();
	finishFirst();
	expect(changed).not.toHaveBeenCalled();
	expect(store.getState().loadingIndicators).toEqual([second, replacement]);
	finishSecond();
	finishReplacement();
	expect(store.getState().loadingIndicators).toEqual([]);
	store.dispose();
});
