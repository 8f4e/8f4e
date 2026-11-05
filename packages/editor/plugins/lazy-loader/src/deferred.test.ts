import type { EditorPlugin } from '@8f4e/editor-core';
import { describe, expect, it, vi } from 'vitest';
import { setup } from './__tests__/editor';
import { createDeferredPluginLoaderPlugin } from './deferred';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(complete => {
		resolve = complete;
	});
	return { promise, resolve };
}

function install(load: () => Promise<EditorPlugin>) {
	const editor = setup([]);
	const dispose = createDeferredPluginLoaderPlugin({ load }).setup(editor);
	return { ...editor, dispose };
}

describe('deferred plugin loader', () => {
	it('starts imports once on renderer readiness and uses current state', async () => {
		const cleanup = vi.fn();
		const setupPlugin = vi.fn<EditorPlugin['setup']>(() => cleanup);
		const load = vi.fn(async () => ({ id: 'optional', setup: setupPlugin }));
		const editor = install(load);
		try {
			expect(load).not.toHaveBeenCalled();
			expect(editor.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
			await Promise.resolve();
			expect(load).not.toHaveBeenCalled();
			editor.events.dispatch('init');
			expect(load).not.toHaveBeenCalled();
			editor.state.viewport.x = 123;
			editor.events.dispatch('ready');
			editor.events.dispatch('ready');
			expect(load).toHaveBeenCalledOnce();
			expect(editor.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
				{ id: 'editor-plugins', message: 'Loading editor plugins...', status: 'loading' },
			]);
			await vi.waitFor(() => expect(setupPlugin).toHaveBeenCalledOnce());
			expect(editor.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
			expect(setupPlugin.mock.calls[0][0].store.getState().viewport.x).toBe(123);
		} finally {
			editor.dispose();
		}
		editor.dispose();
		expect(cleanup).toHaveBeenCalledOnce();
	});
	it.each(['before readiness', 'during import'])('ignores late work when disposed %s', async when => {
		const pending = deferred<EditorPlugin>();
		const setupPlugin = vi.fn<EditorPlugin['setup']>(() => () => {});
		const load = vi.fn(() => pending.promise);
		const editor = install(load);
		if (when === 'during import') editor.events.dispatch('ready');
		editor.dispose();
		expect(editor.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		if (when === 'before readiness') editor.events.dispatch('ready');
		pending.resolve({ id: 'optional', setup: setupPlugin });
		await Promise.resolve();
		expect(setupPlugin).not.toHaveBeenCalled();
		expect(load).toHaveBeenCalledTimes(when === 'during import' ? 1 : 0);
	});
	it.each(['load', 'setup'])('logs a %s failure', async phase => {
		const error = new Error(`${phase} failed`);
		const editor = install(async () => {
			if (phase === 'load') throw error;
			return {
				id: 'broken',
				setup: () => {
					throw error;
				},
			};
		});
		editor.events.dispatch('ready');
		await vi.waitFor(() => expect(editor.state.console.logs.at(-1)?.message).toContain(error.message));
		expect(editor.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		editor.dispose();
	});
});
