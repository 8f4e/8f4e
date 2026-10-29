import type { EditorPlugin, EditorPluginContext } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import { describe, expect, it, vi } from 'vitest';
import { emptySource, matchingSource, setup } from './__tests__/editor';
import { hasDirective, type LazyEditorPlugin } from './index';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => {
		resolve = done;
	});
	return { promise, resolve };
}

function entry() {
	const cleanup = vi.fn();
	const plugin: EditorPlugin = { id: 'custom', setup: vi.fn(() => cleanup) };
	const registration: LazyEditorPlugin = {
		id: 'custom',
		matches: project => hasDirective(project, 'custom'),
		load: vi.fn(async () => plugin),
	};
	return { registration, plugin, cleanup };
}

describe('lazy plugin loader', () => {
	it('loads on project replacement only when a signal matches and keeps the plugin installed', async () => {
		const { registration, plugin, cleanup } = entry();
		const editor = setup([registration]);
		editor.load(emptySource);
		expect(registration.load).not.toHaveBeenCalled();
		editor.load(matchingSource);
		await vi.waitFor(() => expect(plugin.setup).toHaveBeenCalledOnce());
		editor.load(emptySource);
		editor.load(matchingSource);
		expect(registration.load).toHaveBeenCalledOnce();
		expect(cleanup).not.toHaveBeenCalled();
	});

	it('scans the current project when installed after loading', async () => {
		const { registration, plugin } = entry();
		setup([registration], matchingSource);
		await vi.waitFor(() => expect(plugin.setup).toHaveBeenCalledOnce());
	});

	it('requires the contributed menu action after edits and removes its registrations on disposal', async () => {
		const { registration, plugin } = entry();
		const editor = setup([registration], emptySource);
		const block = editor.state.codeBlockRendering.codeBlocks.find(block => block.name === 'audio')!;
		applyCodeBlockSourceEdits(editor.store, [{ codeBlock: block, code: ['module audio', '; @custom', 'moduleEnd'] }], {
			affectsCompilation: true,
		});
		expect(registration.load).not.toHaveBeenCalled();
		const item = (await editor.openMenu()).find(item => item.action === 'loadPluginsUsedByProject')!;
		expect(item).toBeDefined();
		editor.events.dispatch(item.action!, item.payload);
		await vi.waitFor(() => expect(plugin.setup).toHaveBeenCalledOnce());
		editor.dispose();
		expect((await editor.openMenu()).some(candidate => candidate.action === item.action)).toBe(false);
		editor.load(matchingSource);
		editor.events.dispatch('loadPluginsUsedByProject');
		expect(registration.load).toHaveBeenCalledOnce();
	});

	it('shares a pending load across scans and refreshes the current project when it resolves', async () => {
		const { registration, plugin } = entry();
		const pending = deferred<EditorPlugin>();
		registration.load = vi.fn(() => pending.promise);
		plugin.setup = vi.fn(({ directives }: EditorPluginContext) =>
			directives.register({
				name: 'custom',
				apply: (directive, draft) => {
					draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 3 });
				},
			})
		);
		const editor = setup([registration], matchingSource);
		editor.events.dispatch('loadPluginsUsedByProject');
		editor.load(matchingSource.replace('audio', 'replacement'));
		const block = editor.state.codeBlockRendering.codeBlocks.find(block => block.name === 'replacement')!;
		expect(block.gaps.size).toBe(0);
		const revision = editor.state.projectChange.revision;
		const compilerRevision = editor.state.compilerInputRevision;
		pending.resolve(plugin);
		await vi.waitFor(() => expect(block.gaps.get(1)?.size).toBe(3));
		expect(registration.load).toHaveBeenCalledOnce();
		expect(plugin.setup).toHaveBeenCalledOnce();
		expect(editor.state.projectChange.revision).toBe(revision);
		expect(editor.state.compilerInputRevision).toBe(compilerRevision);
	});

	it('does not install a plugin if its editor is disposed while importing', async () => {
		const { registration, plugin } = entry();
		const pending = deferred<EditorPlugin>();
		registration.load = vi.fn(() => pending.promise);
		const editor = setup([registration], matchingSource);
		editor.dispose();
		pending.resolve(plugin);
		await pending.promise;
		expect(plugin.setup).not.toHaveBeenCalled();
	});

	it('installs ready imports without waiting for earlier registry entries', async () => {
		const first = deferred<EditorPlugin>();
		const second = deferred<EditorPlugin>();
		const calls: string[] = [];
		setup([
			{ id: 'first', matches: () => true, load: () => first.promise },
			{ id: 'second', matches: () => true, load: () => second.promise },
		]);
		const plugin = (id: string): EditorPlugin => ({
			id,
			setup: () => {
				calls.push(id);
				return () => {};
			},
		});
		second.resolve(plugin('second'));
		await second.promise;
		expect(calls).toEqual(['second']);
		first.resolve(plugin('first'));
		await first.promise;
		expect(calls).toEqual(['second', 'first']);
	});

	it('keeps setup and cleanup separate for editors using the same loaded module', async () => {
		const cleanups = [vi.fn(), vi.fn()];
		const plugin: EditorPlugin = { id: 'shared', setup: vi.fn(() => cleanups.shift()!) };
		const firstCleanup = cleanups[0];
		const secondCleanup = cleanups[1];
		const registration: LazyEditorPlugin = { id: 'shared', matches: () => true, load: async () => plugin };
		const first = setup([registration]);
		const second = setup([registration]);
		await vi.waitFor(() => expect(plugin.setup).toHaveBeenCalledTimes(2));
		first.dispose();
		expect(firstCleanup).toHaveBeenCalledOnce();
		expect(secondCleanup).not.toHaveBeenCalled();
		second.dispose();
		expect(secondCleanup).toHaveBeenCalledOnce();
	});

	it('reports failed imports and allows another manual attempt', async () => {
		const { registration, plugin } = entry();
		registration.load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(plugin);
		const editor = setup([registration], matchingSource);
		await vi.waitFor(() =>
			expect(editor.state.console.logs.map(log => log.message).join('\n')).toContain('Failed to load plugin custom')
		);
		expect(plugin.setup).not.toHaveBeenCalled();
		editor.events.dispatch('loadPluginsUsedByProject');
		await vi.waitFor(() => expect(plugin.setup).toHaveBeenCalledOnce());
	});

	it('disposes every installed plugin in reverse installation order even if one cleanup fails', async () => {
		const calls: string[] = [];
		const plugins = ['first', 'second'].map(id => ({
			id,
			matches: () => true,
			load: async () => ({
				id,
				setup: () => () => {
					calls.push(id);
					if (id === 'second') throw new Error('cleanup');
				},
			}),
		}));
		const editor = setup(plugins);
		await Promise.resolve();
		expect(() => editor.dispose()).toThrow('Lazy plugin cleanup failed');
		expect(calls).toEqual(['second', 'first']);
	});
});
