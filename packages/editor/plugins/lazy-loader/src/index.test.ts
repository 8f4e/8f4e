import type { EditorPlugin, EditorPluginContext } from '@8f4e/editor-core';
import {
	applyCodeBlockSourceEdits,
	createEditorEditingHandle,
	getEditorBlockId,
	matchEditorDirectives,
} from '@8f4e/editor-state';
import { describe, expect, it, vi } from 'vitest';
import { emptySource, matchingSource, setup } from './__tests__/editor';
import { hasConfig, hasDirective, type LazyEditorPlugin } from './index';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => {
		resolve = done;
	});
	return { promise, resolve };
}

function entry(scope: LazyEditorPlugin['scope'] = 'view', id = 'custom') {
	const cleanup = vi.fn();
	const plugin: EditorPlugin = { id, setup: vi.fn(() => cleanup) };
	const registration: LazyEditorPlugin = {
		id,
		scope,
		matches: directives => hasDirective(directives, id),
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

	it('loads automatically after source edits without a manual menu action', async () => {
		const { registration, plugin } = entry();
		const editor = setup([registration], emptySource);
		const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'audio')!;
		applyCodeBlockSourceEdits(editor.store, [{ codeBlock: block, code: ['module audio', '; @custom', 'moduleEnd'] }], {
			affectsCompilation: true,
		});
		await vi.waitFor(() => expect(plugin.setup).toHaveBeenCalledOnce());
		expect((await editor.openMenu()).some(candidate => candidate.action === 'loadPluginsUsedByProject')).toBe(false);
	});

	it('loads after typing and pasting blocks', async () => {
		const typed = entry('view', 'typed');
		const pasted = entry('view', 'pasted');
		const editor = setup([typed.registration, pasted.registration], emptySource);
		const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'audio')!;
		editor.events.dispatch('enterEditMode');
		editor.store.set('codeBlockRendering.selectedCodeBlock', block);
		editor.store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 1);
		editor.events.dispatch('insertNewLine');
		editor.store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 1);
		editor.events.dispatch('insertText', { text: '; @typed' });
		await vi.waitFor(() => expect(typed.plugin.setup).toHaveBeenCalledOnce());
		editor.state.callbacks.readClipboardText = async () =>
			JSON.stringify([
				{ code: ['module pasted', '; @pasted', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 }, entry: 'main' },
				{ code: ['module second', 'moduleEnd'], gridCoordinates: { x: 5, y: 0 }, entry: 'main' },
			]);
		editor.events.dispatch('pasteCodeBlocks', { x: 100, y: 100 });
		await vi.waitFor(() => expect(pasted.plugin.setup).toHaveBeenCalledOnce());
	});

	it.each(['undo', 'redo'] as const)('loads automatically when %s restores a signal', async operation => {
		const { registration, plugin } = entry();
		const editor = setup([registration], emptySource);
		editor.events.dispatch('enterEditMode');
		const { handle } = createEditorEditingHandle(editor.store, editor.events);
		const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'audio')!;
		const update = (code: string[]) =>
			handle.applyEdits({
				expectedRevision: handle.getRevision(),
				edits: [{ type: 'update', blockId: getEditorBlockId(block), code }],
			});
		update(['module audio', '; @custom', 'moduleEnd']);
		if (operation === 'undo') update(['module audio', 'moduleEnd']);
		else handle.undo({ expectedRevision: handle.getRevision() });
		await Promise.resolve();
		expect(registration.load).not.toHaveBeenCalled();
		handle[operation]({ expectedRevision: handle.getRevision() });
		await vi.waitFor(() => expect(plugin.setup).toHaveBeenCalledOnce());
	});

	it('loads view plugins only when entering their group and keeps them installed after leaving', async () => {
		const outer = entry('view', 'outer');
		const inner = entry();
		const editor = setup(
			[outer.registration, inner.registration],
			`8f4e/v1
entry main
group outer
note settings
; @outer
noteEnd
entry main
group inner
entry main
module audio
; @custom
moduleEnd
entryEnd
groupEnd
entryEnd
groupEnd
entryEnd`
		);
		await Promise.resolve();
		expect(outer.registration.load).not.toHaveBeenCalled();
		expect(inner.registration.load).not.toHaveBeenCalled();
		const revision = editor.state.projectChange.revision;
		editor.events.dispatch('openProjectGroup', {
			codeBlock: editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'outer')!,
		});
		await vi.waitFor(() => expect(outer.plugin.setup).toHaveBeenCalledOnce());
		expect(inner.registration.load).not.toHaveBeenCalled();
		const group = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'inner')!;
		editor.events.dispatch('openProjectGroup', { codeBlock: group });
		await vi.waitFor(() => expect(inner.plugin.setup).toHaveBeenCalledOnce());
		editor.events.dispatch('goToParentProjectGroup');
		editor.events.dispatch('goToRootProjectGroup');
		await Promise.resolve();
		expect(editor.state.projectChange.revision).toBe(revision);
		expect(outer.registration.load).toHaveBeenCalledOnce();
		expect(inner.registration.load).toHaveBeenCalledOnce();
		expect(outer.cleanup).not.toHaveBeenCalled();
		expect(inner.cleanup).not.toHaveBeenCalled();
	});

	it('loads project plugins from cached configuration in unopened groups', async () => {
		const { registration, plugin } = entry('project');
		registration.matches = directives => hasConfig(directives, 'customSettings');
		const editor = setup(
			[registration],
			`8f4e/v1
entry main
group outer
entry main
group inner
note settings
; @config customSettings.enabled false
noteEnd
entry main
entryEnd
groupEnd
entryEnd
groupEnd
entryEnd`
		);
		await vi.waitFor(() => expect(plugin.setup).toHaveBeenCalledOnce());
		expect(editor.state.codeBlockRendering.currentProject.blocks).toBe(
			editor.state.codeBlockRendering.rootProject.blocks
		);
	});

	it('checks the settled view after API edits and loads newly needed plugins on return navigation', async () => {
		const { registration, plugin } = entry();
		const editor = setup([registration], emptySource.replace('entryEnd', 'group nested\ngroupEnd\nentryEnd'));
		const group = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'nested')!;
		editor.events.dispatch('openProjectGroup', { codeBlock: group });
		await Promise.resolve();
		editor.events.dispatch('enterEditMode');
		const { handle } = createEditorEditingHandle(editor.store, editor.events);
		handle.applyEdits({
			expectedRevision: handle.getRevision(),
			edits: [{ type: 'insert', code: ['module added', '; @custom', 'moduleEnd'], entry: 'main', projectPath: '' }],
		});
		await Promise.resolve();
		expect(registration.load).not.toHaveBeenCalled();
		editor.events.dispatch('goToParentProjectGroup');
		await vi.waitFor(() => expect(plugin.setup).toHaveBeenCalledOnce());
	});

	it('does not scan queued changes or later replacements after disposal', async () => {
		const { registration } = entry();
		const editor = setup([registration], emptySource);
		editor.load(matchingSource);
		editor.dispose();
		await Promise.resolve();
		editor.load(matchingSource);
		await Promise.resolve();
		expect(registration.load).not.toHaveBeenCalled();
	});

	it('shares a pending load across scans and refreshes the current project when it resolves', async () => {
		const { registration, plugin } = entry();
		const pending = deferred<EditorPlugin>();
		registration.load = vi.fn(() => pending.promise);
		plugin.setup = vi.fn(({ layout }: EditorPluginContext) => {
			const contribution = layout.createContribution();
			const unsubscribe = layout.subscribe(({ codeBlock }) =>
				contribution.update(codeBlock, {
					verticalSpaceAfterSourceLine: matchEditorDirectives(codeBlock.parsedDirectives, [{ name: 'custom' }]).map(
						directive => ({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 3 })
					),
				})
			);
			return () => {
				unsubscribe();
				contribution.dispose();
			};
		});
		const editor = setup([registration], matchingSource);
		editor.load(matchingSource.replace('audio', 'replacement'));
		const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'replacement')!;
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
			{ id: 'first', scope: 'view', matches: () => true, load: () => first.promise },
			{ id: 'second', scope: 'view', matches: () => true, load: () => second.promise },
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
		const registration: LazyEditorPlugin = {
			id: 'shared',
			scope: 'view',
			matches: () => true,
			load: async () => plugin,
		};
		const first = setup([registration]);
		const second = setup([registration]);
		await vi.waitFor(() => expect(plugin.setup).toHaveBeenCalledTimes(2));
		first.dispose();
		expect(firstCleanup).toHaveBeenCalledOnce();
		expect(secondCleanup).not.toHaveBeenCalled();
		second.dispose();
		expect(secondCleanup).toHaveBeenCalledOnce();
	});

	it('reports failed imports and retries on the next matching change', async () => {
		const { registration, plugin } = entry();
		registration.load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(plugin);
		const editor = setup([registration], matchingSource);
		await vi.waitFor(() =>
			expect(editor.state.console.logs.map(log => log.message).join('\n')).toContain('Failed to load plugin custom')
		);
		expect(plugin.setup).not.toHaveBeenCalled();
		editor.load(matchingSource);
		await vi.waitFor(() => expect(plugin.setup).toHaveBeenCalledOnce());
	});

	it('disposes every installed plugin in reverse installation order even if one cleanup fails', async () => {
		const calls: string[] = [];
		const plugins: LazyEditorPlugin[] = ['first', 'second'].map(id => ({
			id,
			scope: 'view',
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
