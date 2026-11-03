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

function install(load: () => Promise<readonly EditorPlugin[]>) {
	const editor = setup([]);
	const dispose = createDeferredPluginLoaderPlugin({ load }).setup(editor);
	return { ...editor, dispose };
}

describe('deferred plugin loader', () => {
	it('starts imports once on renderer readiness and uses current state', async () => {
		const setupPlugin = vi.fn<EditorPlugin['setup']>(() => () => {});
		const load = vi.fn(async () => [{ id: 'optional', setup: setupPlugin }]);
		const editor = install(load);
		try {
			expect(load).not.toHaveBeenCalled();
			await Promise.resolve();
			expect(load).not.toHaveBeenCalled();
			editor.events.dispatch('init');
			expect(load).not.toHaveBeenCalled();
			editor.state.viewport.x = 123;
			editor.events.dispatch('ready');
			editor.events.dispatch('ready');
			expect(load).toHaveBeenCalledOnce();
			await vi.waitFor(() => expect(setupPlugin).toHaveBeenCalledOnce());
			expect(setupPlugin.mock.calls[0][0].store.getState().viewport.x).toBe(123);
		} finally {
			editor.dispose();
		}
	});
	it.each(['before readiness', 'during import'])('ignores late work when disposed %s', async when => {
		const pending = deferred<readonly EditorPlugin[]>();
		const setupPlugin = vi.fn<EditorPlugin['setup']>(() => () => {});
		const load = vi.fn(() => pending.promise);
		const editor = install(load);
		if (when === 'during import') editor.events.dispatch('ready');
		editor.dispose();
		if (when === 'before readiness') editor.events.dispatch('ready');
		pending.resolve([{ id: 'optional', setup: setupPlugin }]);
		await Promise.resolve();
		expect(setupPlugin).not.toHaveBeenCalled();
		expect(load).toHaveBeenCalledTimes(when === 'during import' ? 1 : 0);
	});
	it('cleans up in reverse order and releases earlier installations if a later setup fails', async () => {
		const released: string[] = [];
		const editor = install(async () => [
			{ id: 'first', setup: () => () => released.push('first') },
			{ id: 'second', setup: () => () => released.push('second') },
			{
				id: 'broken',
				setup: () => {
					throw new Error('setup failed');
				},
			},
		]);
		editor.events.dispatch('ready');
		await vi.waitFor(() => expect(released).toEqual(['second', 'first']));
		expect(editor.state.console.logs.at(-1)?.message).toContain('setup failed');
		editor.dispose();
		expect(released).toEqual(['second', 'first']);
	});
});
