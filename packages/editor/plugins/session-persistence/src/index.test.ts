import { parseProjectSource } from '@8f4e/compiler';
import {
	applyCodeBlockSourceEdits,
	createEditorCommandApi,
	deleteCodeBlocks,
	EMPTY_DEFAULT_PROJECT,
	getEditorBlockId,
	serializeToProject,
} from '@8f4e/editor-state';
import { getProjectGroups, getProjectModules } from '@8f4e/language-spec';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupPlugin } from './__tests__/setup';
import { createSessionPersistencePlugin } from './index';

const cleanups: Array<() => void> = [];
const project = parseProjectSource(
	'8f4e/v1\nentry main\nmodule retained\n; @pos 4 3\nint value 1\nmoduleEnd\nentryEnd'
);
function createStorage() {
	const values = new Map<string, string>();
	return {
		getItem: vi.fn((key: string) => values.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			values.set(key, value);
		}),
	};
}
function setup(storage = createStorage(), restoreOnStartup = true, storageKey = 'session') {
	const test = setupPlugin(createSessionPersistencePlugin({ storage, storageKey, restoreOnStartup }));
	cleanups.push(test.dispose);
	const boot = () => {
		test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		test.events.dispatch('enterEditMode');
		test.events.dispatch('prepareInitialProject');
	};
	return { ...test, storage, boot };
}
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.useRealTimers();
});

describe('session persistence plugin', () => {
	it('restores on init before starting autosaves', () => {
		const storage = createStorage();
		storage.setItem('session', JSON.stringify(project));
		storage.setItem.mockClear();
		const test = setup(storage);
		test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		test.events.dispatch('enterEditMode');
		expect(storage.getItem).not.toHaveBeenCalled();
		expect(storage.setItem).not.toHaveBeenCalled();
		test.events.dispatch('prepareInitialProject');
		expect(test.state.project.activeLevel.blocks.some(block => block.name === 'retained')).toBe(true);
		expect(getProjectModules(JSON.parse(storage.getItem('session')!))[0].code).toContain('module retained');
		expect(storage.setItem).toHaveBeenCalledOnce();
	});

	it('keeps an empty project when no session exists', () => {
		const test = setup();
		test.boot();
		expect(serializeToProject(test.state)).toMatchObject({
			entries: [],
			execution: [],
			notes: [],
		});
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))).toEqual([]);
	});

	it('skips restoration and keeps autosaving enabled when startup belongs to another loader', () => {
		const storage = createStorage();
		storage.setItem('session', JSON.stringify(project));
		const test = setup(storage, false);
		test.boot();
		expect(storage.getItem).not.toHaveBeenCalled();
		expect(test.state.project.activeLevel.blocks.some(block => block.name === 'retained')).toBe(false);
		expect(storage.setItem).toHaveBeenCalledWith('session', expect.any(String));
		test.events.dispatch('loadProject', { project });
		test.events.dispatch('enterEditMode');
		expect(getProjectModules(JSON.parse(storage.getItem('session')!))[0].code).toContain('module retained');
	});

	it('autosaves source changes, API edits, snapshot restoration, and deletion', () => {
		const test = setup();
		test.boot();
		test.events.dispatch('loadProject', { project });
		test.events.dispatch('enterEditMode');
		const block = test.state.project.activeLevel.blocks.find(block => block.name === 'retained')!;
		test.store.set('project.selectedCodeBlock', block);
		block.cursor.row = 2;
		block.cursor.col = block.code[2].length;
		applyCodeBlockSourceEdits(test.store, [
			{ codeBlock: block, code: block.code.map((line, row) => (row === 2 ? `${line}2` : line)) },
		]);
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toContain('int value 12');
		const typed = test.store.projectTransactions.capture();
		const editing = createEditorCommandApi(test.store, test.events);
		cleanups.push(editing.dispose);
		editing.handle.applyEdits({
			expectedRevision: editing.handle.getRevision(),
			edits: [
				{ type: 'update', blockId: getEditorBlockId(block), code: ['module retained', 'int value 3', 'moduleEnd'] },
			],
		});
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toContain('int value 3');
		const edited = test.store.projectTransactions.capture();
		test.store.projectTransactions.restore(typed);
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toContain('int value 12');
		test.store.projectTransactions.restore(edited);
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toContain('int value 3');
		deleteCodeBlocks(test.store, [test.state.project.activeLevel.blocks.find(block => block.name === 'retained')!]);
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))).toEqual([]);
	});

	it('does not save an API update that keeps the same source', () => {
		const test = setup();
		test.boot();
		test.events.dispatch('loadProject', { project });
		test.events.dispatch('enterEditMode');
		const block = test.state.project.activeLevel.blocks.find(block => block.name === 'retained')!;
		const editing = createEditorCommandApi(test.store, test.events);
		cleanups.push(editing.dispose);
		const revision = editing.handle.getRevision();
		test.storage.setItem.mockClear();
		const result = editing.handle.applyEdits({
			expectedRevision: revision,
			edits: [{ type: 'update', blockId: getEditorBlockId(block), code: [...block.code] }],
		});
		expect(test.storage.setItem).not.toHaveBeenCalled();
		expect(result.revision).toBe(revision);
	});

	it('autosaves generated environment changes, ignores writes to read-only source and saves restored source', () => {
		const test = setup();
		test.boot();
		test.events.dispatch('loadProject', { project });
		test.events.dispatch('enterEditMode');
		const { handle: editing, dispose } = createEditorCommandApi(test.store, test.events);
		cleanups.push(dispose);
		const block = test.state.project.rootLevel.blocks.find(block => block.name === 'retained')!;
		const original = test.store.projectTransactions.capture();
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(block),
					code: block.code.map(line => (line === 'int value 1' ? 'int value 2' : line)),
				},
			],
		});
		const edited = test.store.projectTransactions.capture();
		test.store.projectTransactions.restore(original);
		const before = editing.getRevision();
		const compilerRevision = test.state.compilerInputRevision;
		test.storage.setItem.mockClear();
		test.store.set('envConstantContributions.provider', ['const GENERATED 42']);
		const environment = test.state.project.rootLevel.blocks.find(block => block.name === 'env')!;
		editing.applyEdits({
			expectedRevision: editing.getRevision(),
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(environment),
					code: ['constants env', '; @pos 30 40', 'constantsEnd'],
				},
			],
		});
		expect(test.storage.setItem).toHaveBeenCalledTimes(1);
		expect(editing.getRevision()).not.toBe(before);
		expect(test.state.compilerInputRevision).toBe(compilerRevision + 1);
		const saved = () => JSON.parse(test.storage.getItem('session')!);
		expect(saved().constants[0].code).toContain('const GENERATED 42');
		expect(saved().constants[0].code).toContain('; @pos 0 0');
		test.store.projectTransactions.restore(edited);
		expect(getProjectModules(saved())[0].code).toContain('int value 2');
		expect(saved().constants[0].code).toContain('const GENERATED 42');
		expect(saved().constants[0].code).toContain('; @pos 0 0');
	});

	it('does not autosave selection, caret movement, or empty edits after restoration', async () => {
		vi.useFakeTimers();
		const test = setup();
		test.boot();
		test.events.dispatch('loadProject', { project });
		test.events.dispatch('enterEditMode');
		const block = test.state.project.activeLevel.blocks.find(block => block.name === 'retained')!;
		const original = test.store.projectTransactions.capture();
		test.store.set('project.selectedCodeBlock', block);
		block.cursor.row = 2;
		block.cursor.col = block.code[2].length;
		applyCodeBlockSourceEdits(test.store, [
			{ codeBlock: block, code: block.code.map((line, row) => (row === 2 ? `${line}2` : line)) },
		]);
		const edited = test.store.projectTransactions.capture();
		test.store.projectTransactions.restore(original);
		const restored = test.state.project.activeLevel.blocks.find(block => block.name === 'retained')!;
		test.storage.setItem.mockClear();
		test.store.set('project.selectedCodeBlock', restored);
		test.store.set('project.selectedCodeBlock', restored);
		test.store.set('project.selectedCodeBlock.cursor.row', 1);
		applyCodeBlockSourceEdits(test.store, [{ codeBlock: restored, code: [...restored.code] }]);
		await vi.advanceTimersByTimeAsync(2000);
		expect(test.storage.setItem).not.toHaveBeenCalled();
		test.store.projectTransactions.restore(edited);
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toContain('int value 12');
	});

	it('shares one completed change across API revisions and saves for batches and restoration', () => {
		const test = setup();
		test.boot();
		test.events.dispatch('loadProject', { project });
		test.events.dispatch('enterEditMode');
		const editing = createEditorCommandApi(test.store, test.events);
		cleanups.push(editing.dispose);
		const block = test.state.project.activeLevel.blocks.find(block => block.name === 'retained')!;
		const changes: Array<typeof test.state.projectChange> = [];
		test.store.subscribe('projectChange', change => changes.push(change));
		const startRevision = test.state.projectChange.revision;
		const token = editing.handle.getRevision();
		const original = test.store.projectTransactions.capture();
		test.storage.setItem.mockClear();
		const applied = editing.handle.applyEdits({
			expectedRevision: token,
			edits: [
				{ type: 'update', blockId: getEditorBlockId(block), code: ['module retained', 'int value 3', 'moduleEnd'] },
				{ type: 'insert', code: ['note added', 'API batch', 'noteEnd'] },
			],
		});
		expect(changes).toEqual([{ revision: startRevision + 1, kind: 'edit', history: 'checkpoint' }]);
		expect(applied.revision).toBe(editing.handle.getRevision());
		expect(test.storage.setItem).toHaveBeenCalledOnce();
		expect(JSON.parse(test.storage.getItem('session')!).notes).toHaveLength(1);

		const edited = test.store.projectTransactions.capture();
		test.store.projectTransactions.restore(original);
		const restoredRevision = editing.handle.getRevision();
		expect(restoredRevision).not.toBe(applied.revision);
		expect(JSON.parse(test.storage.getItem('session')!).notes).toHaveLength(0);
		test.store.projectTransactions.restore(edited);
		const editedRevision = editing.handle.getRevision();
		expect(editedRevision).not.toBe(restoredRevision);
		expect(JSON.parse(test.storage.getItem('session')!).notes).toHaveLength(1);
		expect(test.storage.setItem).toHaveBeenCalledTimes(3);
		expect(changes.map(change => change.kind)).toEqual(['edit', 'restore', 'restore']);

		// Reopening identical content is a different project lifetime and invalidates old API tokens.
		test.events.dispatch('loadProject', { project: JSON.parse(test.storage.getItem('session')!) });
		test.events.dispatch('enterEditMode');
		expect(editing.handle.getRevision()).not.toBe(editedRevision);
		expect(changes).toHaveLength(4);
		expect(changes[3]).toEqual({ revision: startRevision + 4, kind: 'replace' });
		expect(test.storage.setItem).toHaveBeenCalledTimes(4);
	});

	it('publishes one final replacement when loading regenerates environment constants', () => {
		const test = setup();
		test.boot();
		const changes: Array<typeof test.state.projectChange> = [];
		test.store.subscribe('projectChange', change => changes.push(change));
		test.storage.setItem.mockClear();
		test.events.dispatch('loadProject', {
			project: parseProjectSource('8f4e/v1\nconstants env\nconst OBSOLETE 1\nconstantsEnd'),
		});
		test.events.dispatch('enterEditMode');
		expect(changes).toHaveLength(1);
		expect(changes[0].kind).toBe('replace');
		expect(test.storage.setItem).toHaveBeenCalledOnce();
		expect(JSON.parse(test.storage.getItem('session')!).constants[0].code).toContain(
			'; Auto-generated environment constants'
		);
		expect(JSON.parse(test.storage.getItem('session')!).constants[0].code).not.toContain('const OBSOLETE 1');
	});

	it('shares position edits across consumers and keeps compiler-only requests separate', () => {
		const test = setup();
		test.boot();
		test.events.dispatch('loadProject', {
			project: {
				...structuredClone(project),
				constants: [{ id: 9, code: ['constants env', '; @pos 120 60', 'constantsEnd'] }],
			},
		});
		test.events.dispatch('enterEditMode');
		const editing = createEditorCommandApi(test.store, test.events);
		cleanups.push(editing.dispose);
		const block = test.state.project.activeLevel.blocks.find(block => block.name === 'retained')!;
		const token = editing.handle.getRevision();
		const compilerRevision = test.state.compilerInputRevision;
		const projectRevision = test.state.projectChange.revision;
		const original = test.store.projectTransactions.capture();
		test.storage.setItem.mockClear();
		test.events.dispatch('pointerdown', { x: block.x + 8, y: block.y + 8 });
		test.events.dispatch('pointermove', {
			movementX: test.state.viewport.vGrid * 2,
			movementY: test.state.viewport.hGrid * 2,
		});
		test.events.dispatch('pointerup');
		expect(test.state.projectChange).toEqual({ revision: projectRevision + 1, kind: 'edit', history: 'debounced' });
		expect(editing.handle.getRevision()).not.toBe(token);
		expect(test.state.compilerInputRevision).toBe(compilerRevision + 1);
		expect(test.storage.setItem).toHaveBeenCalledOnce();
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toEqual([
			'module retained',
			'; @pos 6 5',
			'int value 1',
			'moduleEnd',
		]);
		test.store.projectTransactions.restore(original);
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toContain('; @pos 4 3');

		// A compiler-only request does not create a project edit or an API revision.
		const afterRestore = editing.handle.getRevision();
		test.storage.setItem.mockClear();
		test.store.set('compilerInputRevision', test.state.compilerInputRevision + 1);
		expect(editing.handle.getRevision()).toBe(afterRestore);
		expect(test.storage.setItem).not.toHaveBeenCalled();
	});

	it('saves the root project while navigating a nested project slice', () => {
		const test = setup();
		test.boot();
		const grouped = parseProjectSource(
			'8f4e/v1\nentry main\ngroup voice\nentry main\nmodule oscillator\nmoduleEnd\nentryEnd\ngroupEnd\nentryEnd'
		);
		test.events.dispatch('loadProject', { project: grouped });
		test.events.dispatch('enterEditMode');
		const group = test.state.project.activeLevel.blocks.find(block => block.name === 'voice')!;
		test.storage.setItem.mockClear();
		Object.assign(test.state.viewport, { x: 256, y: -128 });
		test.store.set('project.selectedCodeBlock', group);
		test.events.dispatch('openProjectGroup', { codeBlock: group });
		expect(test.state.project.rootLevel.viewport).toEqual({ x: 256, y: -128 });
		expect(test.state.project.rootLevel.selectedBlock).toBe(group);
		expect(test.storage.setItem).not.toHaveBeenCalled();
		test.store.set('projectChange', {
			revision: test.state.projectChange.revision + 1,
			kind: 'edit',
			history: 'debounced',
		});
		expect(test.storage.getItem('session')).not.toContain('viewport');
		expect(test.storage.getItem('session')).not.toContain('selectedBlock');
		expect(getProjectGroups(JSON.parse(test.storage.getItem('session')!))[0].name).toBe('voice');
	});

	it('isolates storage keys and disposes its subscriptions and listeners', () => {
		const storage = createStorage();
		const first = setup(storage, false, 'first');
		const second = setup(storage, false, 'second');
		first.boot();
		second.boot();
		first.events.dispatch('loadProject', { project });
		expect(getProjectModules(JSON.parse(storage.getItem('first')!))).toHaveLength(1);
		expect(getProjectModules(JSON.parse(storage.getItem('second')!))).toEqual([]);
		first.disposePlugin();
		storage.setItem.mockClear();
		first.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		first.store.set('projectChange', {
			revision: first.state.projectChange.revision + 1,
			kind: 'edit',
			history: 'debounced',
		});
		first.events.dispatch('prepareInitialProject');
		expect(storage.setItem).not.toHaveBeenCalled();
		second.events.dispatch('loadProject', { project });
		expect(getProjectModules(JSON.parse(storage.getItem('second')!))).toHaveLength(1);
	});

	it('reports unreadable stored JSON and continues with the empty project', () => {
		const storage = createStorage();
		storage.setItem('session', '{');
		const test = setup(storage);
		test.boot();
		expect(test.state.console.logs.some(log => log.message.includes('Failed to restore editor session'))).toBe(true);
		expect(serializeToProject(test.state)).toMatchObject({
			entries: [],
			execution: [],
			notes: [],
		});
	});

	it('reports rejected stored project source without replacing the session at startup', () => {
		const storage = createStorage();
		const saved = JSON.stringify({ ...project, code: ['pass env'] });
		storage.setItem('session', saved);
		storage.setItem.mockClear();
		const test = setup(storage);
		test.boot();
		expect(
			test.state.console.logs.some(log => log.message.includes('Root project source must be inside document blocks'))
		).toBe(true);
		expect(storage.setItem).not.toHaveBeenCalled();
		expect(storage.getItem('session')).toBe(saved);
		test.events.dispatch('loadProject', { project });
		expect(getProjectModules(JSON.parse(storage.getItem('session')!))).toHaveLength(1);
	});

	it('reports storage write failures without interrupting source edits', () => {
		const storage = createStorage();
		storage.setItem.mockImplementation(() => {
			throw new Error('Storage full');
		});
		const test = setup(storage);
		test.boot();
		test.events.dispatch('loadProject', { project });
		test.events.dispatch('enterEditMode');
		expect(test.state.project.activeLevel.blocks.some(block => block.name === 'retained')).toBe(true);
		expect(test.state.console.logs.some(log => log.message.includes('Storage full'))).toBe(true);
	});
});
