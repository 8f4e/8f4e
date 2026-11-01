import { parseProjectSource } from '@8f4e/compiler';
import { createEditorEditingHandle, EMPTY_DEFAULT_PROJECT, getEditorBlockId } from '@8f4e/editor-state';
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
		test.events.dispatch('init');
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
		test.events.dispatch('init');
		expect(test.state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'retained')).toBe(true);
		expect(getProjectModules(JSON.parse(storage.getItem('session')!))[0].code).toContain('module retained');
		expect(storage.setItem).toHaveBeenCalledOnce();
	});

	it('keeps an empty project when no session exists', () => {
		const test = setup();
		test.boot();
		expect(test.state.initialProjectState).toMatchObject({ execution: [], notes: [] });
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))).toEqual([]);
	});

	it('skips restoration and keeps autosaving enabled when startup belongs to another loader', () => {
		const storage = createStorage();
		storage.setItem('session', JSON.stringify(project));
		const test = setup(storage, false);
		test.boot();
		expect(storage.getItem).not.toHaveBeenCalled();
		expect(test.state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'retained')).toBe(false);
		expect(storage.setItem).toHaveBeenCalledWith('session', expect.any(String));
		test.events.dispatch('loadProject', { project });
		test.events.dispatch('enterEditMode');
		expect(getProjectModules(JSON.parse(storage.getItem('session')!))[0].code).toContain('module retained');
	});

	it('autosaves typing, API edits, undo/redo, and deletion', () => {
		const test = setup();
		test.boot();
		test.events.dispatch('loadProject', { project });
		test.events.dispatch('enterEditMode');
		const block = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'retained')!;
		test.store.set('codeBlockRendering.selectedCodeBlock', block);
		block.cursor.row = 2;
		block.cursor.col = block.code[2].length;
		test.events.dispatch('insertText', { text: '2' });
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toContain('int value 12');
		const editing = createEditorEditingHandle(test.store, test.events);
		cleanups.push(editing.dispose);
		editing.handle.applyEdits({
			expectedRevision: editing.handle.getRevision(),
			edits: [
				{ type: 'update', blockId: getEditorBlockId(block), code: ['module retained', 'int value 3', 'moduleEnd'] },
			],
		});
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toContain('int value 3');
		test.events.dispatch('undo');
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toContain('int value 12');
		test.events.dispatch('redo');
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toContain('int value 3');
		test.events.dispatch('deleteCodeBlock', {
			codeBlock: test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'retained')!,
		});
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))).toEqual([]);
	});

	it('does not save or record an API update that keeps the same source', () => {
		const test = setup();
		test.boot();
		test.events.dispatch('loadProject', { project });
		test.events.dispatch('enterEditMode');
		const block = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'retained')!;
		const editing = createEditorEditingHandle(test.store, test.events);
		cleanups.push(editing.dispose);
		const revision = editing.handle.getRevision();
		test.storage.setItem.mockClear();
		const result = editing.handle.applyEdits({
			expectedRevision: revision,
			edits: [{ type: 'update', blockId: getEditorBlockId(block), code: [...block.code] }],
		});
		expect(test.storage.setItem).not.toHaveBeenCalled();
		expect(test.state.historyStack).toHaveLength(0);
		expect(result.revision).toBe(revision);
	});

	it('does not autosave selection, caret movement, or empty edits after undo', async () => {
		vi.useFakeTimers();
		const test = setup();
		test.boot();
		test.events.dispatch('loadProject', { project });
		test.events.dispatch('enterEditMode');
		const block = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'retained')!;
		test.store.set('codeBlockRendering.selectedCodeBlock', block);
		block.cursor.row = 2;
		block.cursor.col = block.code[2].length;
		test.events.dispatch('insertText', { text: '2' });
		test.events.dispatch('undo');
		const restored = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'retained')!;
		test.storage.setItem.mockClear();
		test.store.set('codeBlockRendering.selectedCodeBlock', restored);
		test.store.set('codeBlockRendering.selectedCodeBlock', restored);
		test.events.dispatch('moveCaret', { direction: 'down' });
		test.events.dispatch('insertText', { text: '' });
		await vi.advanceTimersByTimeAsync(2000);
		expect(test.storage.setItem).not.toHaveBeenCalled();
		expect(test.state.redoStack).toHaveLength(1);
		test.events.dispatch('redo');
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toContain('int value 12');
	});

	it('shares one completed change across API revisions, history, and saves for batches and restoration', () => {
		const test = setup();
		test.boot();
		test.events.dispatch('loadProject', { project });
		test.events.dispatch('enterEditMode');
		const editing = createEditorEditingHandle(test.store, test.events);
		cleanups.push(editing.dispose);
		const block = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'retained')!;
		const changes: Array<typeof test.state.projectChange> = [];
		test.store.subscribe('projectChange', change => changes.push(change));
		const startRevision = test.state.projectChange.revision;
		const token = editing.handle.getRevision();
		test.storage.setItem.mockClear();
		const applied = editing.handle.applyEdits({
			expectedRevision: token,
			edits: [
				{ type: 'update', blockId: getEditorBlockId(block), code: ['module retained', 'int value 3', 'moduleEnd'] },
				{ type: 'insert', code: ['note added', 'API batch', 'noteEnd'] },
			],
		});
		expect(changes).toEqual([{ revision: startRevision + 1, kind: 'checkpoint' }]);
		expect(applied.revision).toBe(editing.handle.getRevision());
		expect(test.state.historyStack).toHaveLength(1);
		expect(test.storage.setItem).toHaveBeenCalledOnce();
		expect(JSON.parse(test.storage.getItem('session')!).notes).toHaveLength(1);

		const undone = editing.handle.undo({ expectedRevision: applied.revision });
		expect(undone.revision).not.toBe(applied.revision);
		expect(test.state.redoStack).toHaveLength(1);
		expect(JSON.parse(test.storage.getItem('session')!).notes).toHaveLength(0);
		const redone = editing.handle.redo({ expectedRevision: undone.revision });
		expect(redone.revision).not.toBe(applied.revision);
		expect(test.state.historyStack).toHaveLength(1);
		expect(test.state.redoStack).toHaveLength(0);
		expect(JSON.parse(test.storage.getItem('session')!).notes).toHaveLength(1);
		expect(test.storage.setItem).toHaveBeenCalledTimes(3);
		expect(changes.map(change => change.kind)).toEqual(['checkpoint', 'restore', 'restore']);

		// Reopening identical content is a different project lifetime and invalidates old API tokens.
		test.events.dispatch('loadProject', { project: JSON.parse(test.storage.getItem('session')!) });
		test.events.dispatch('enterEditMode');
		expect(editing.handle.getRevision()).not.toBe(redone.revision);
		expect(test.state.historyStack).toHaveLength(0);
		expect(test.state.redoStack).toHaveLength(0);
		expect(changes).toHaveLength(4);
		expect(changes[3]).toEqual({ revision: startRevision + 4, kind: 'replace' });
		expect(test.storage.setItem).toHaveBeenCalledTimes(4);
		const replaced = editing.handle.getRevision();
		expect(() => editing.handle.undo({ expectedRevision: redone.revision })).toThrow('getRevision again');
		editing.handle.undo({ expectedRevision: replaced });
		editing.handle.redo({ expectedRevision: replaced });
		expect(editing.handle.getRevision()).toBe(replaced);
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
		expect(test.state.historyStack).toHaveLength(0);
	});

	it('tracks position edits across all consumers while compilation stays separate', async () => {
		vi.useFakeTimers();
		const test = setup();
		test.boot();
		test.events.dispatch('loadProject', {
			project: {
				...structuredClone(project),
				constants: [{ id: 9, code: ['constants env', '; @pos 120 60', 'constantsEnd'] }],
			},
		});
		test.events.dispatch('enterEditMode');
		const editing = createEditorEditingHandle(test.store, test.events);
		cleanups.push(editing.dispose);
		const block = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'retained')!;
		const token = editing.handle.getRevision();
		const compilerRevision = test.state.compilerInputRevision;
		const projectRevision = test.state.projectChange.revision;
		test.storage.setItem.mockClear();
		test.events.dispatch('mousedown', { x: block.x + 8, y: block.y + 8 });
		test.events.dispatch('mousemove', {
			movementX: test.state.viewport.vGrid * 2,
			movementY: test.state.viewport.hGrid * 2,
		});
		test.events.dispatch('mouseup');
		expect(test.state.projectChange).toEqual({ revision: projectRevision + 1, kind: 'edit' });
		expect(editing.handle.getRevision()).not.toBe(token);
		expect(test.state.compilerInputRevision).toBe(compilerRevision);
		expect(test.storage.setItem).toHaveBeenCalledOnce();
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toEqual([
			'module retained',
			'; @pos 6 5',
			'int value 1',
			'moduleEnd',
		]);
		await vi.advanceTimersByTimeAsync(1000);
		expect(test.state.historyStack).toHaveLength(1);
		test.events.dispatch('undo');
		expect(getProjectModules(JSON.parse(test.storage.getItem('session')!))[0].code).toContain('; @pos 4 3');

		// A compiler-only request does not create a project edit or an API revision.
		const afterUndo = editing.handle.getRevision();
		test.storage.setItem.mockClear();
		test.store.set('compilerInputRevision', test.state.compilerInputRevision + 1);
		expect(editing.handle.getRevision()).toBe(afterUndo);
		expect(test.storage.setItem).not.toHaveBeenCalled();
		expect(test.state.redoStack).toHaveLength(1);
	});

	it('saves the root project while navigating a nested project slice', () => {
		const test = setup();
		test.boot();
		const grouped = parseProjectSource(
			'8f4e/v1\nentry main\ngroup voice\nmodule oscillator\nmoduleEnd\ngroupEnd\nentryEnd'
		);
		test.events.dispatch('loadProject', { project: grouped });
		test.events.dispatch('enterEditMode');
		const group = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'voice')!;
		test.storage.setItem.mockClear();
		Object.assign(test.state.viewport, { x: 256, y: -128 });
		test.store.set('codeBlockRendering.selectedCodeBlock', group);
		test.events.dispatch('openProjectGroup', { codeBlock: group });
		expect(test.state.codeBlockRendering.rootProject.viewport).toEqual({ x: 256, y: -128 });
		expect(test.state.codeBlockRendering.rootProject.selectedBlock).toBe(group);
		expect(test.storage.setItem).not.toHaveBeenCalled();
		test.store.set('projectChange', { revision: test.state.projectChange.revision + 1, kind: 'edit' });
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
		first.store.set('projectChange', { revision: first.state.projectChange.revision + 1, kind: 'edit' });
		first.events.dispatch('init');
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
		expect(test.state.initialProjectState).toMatchObject({ execution: [], notes: [] });
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
		expect(test.state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'retained')).toBe(true);
		expect(test.state.console.logs.some(log => log.message.includes('Storage full'))).toBe(true);
	});
});
