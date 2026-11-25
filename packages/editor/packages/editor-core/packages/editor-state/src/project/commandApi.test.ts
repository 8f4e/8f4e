import { EventEmitter } from 'node:events';
import { getProjectModules } from '@8f4e/language-spec';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import initState, { applyCodeBlockSourceEdits } from '../index';
import { createEditorCommandApi, getEditorBlockId } from './commandApi';
import serializeToProject from './serialization/serializeToProject';

const cleanups: Array<() => void> = [];
function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	events.dispatch('loadProject', {
		project: parseProjectSource('8f4e/v1\nentry main\nmodule target\nint value 1\nmoduleEnd\nentryEnd'),
	});
	events.dispatch('enterEditMode');
	const block = state.project.rootLevel.blocks.find(candidate => candidate.name === 'target')!;
	const editing = createEditorCommandApi(store, events);
	cleanups.push(() => {
		editing.dispose();
		store.dispose();
	});
	return { store, state, block, events, editing: editing.handle };
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('public editor operations', () => {
	it('applies a validated API batch as one history checkpoint', () => {
		const test = setup();
		const beforeEdit = vi.fn(() => serializeToProject(test.state));
		test.events.on('beforeProjectEdit', beforeEdit);
		const beforeRevision = test.editing.getRevision();
		const projectRevision = test.state.projectChange.revision;
		const result = test.editing.applyEdits({
			expectedRevision: beforeRevision,
			edits: [
				{ type: 'update', blockId: getEditorBlockId(test.block), code: ['module target', 'int value 2', 'moduleEnd'] },
				{ type: 'insert', code: ['note added', 'batch', 'noteEnd'] },
			],
		});

		expect(beforeEdit).toHaveBeenCalledOnce();
		expect(getProjectModules(beforeEdit.mock.results[0].value)[0].code).toContain('int value 1');
		expect(getProjectModules(serializeToProject(test.state))[0].code).toContain('int value 2');
		expect(serializeToProject(test.state).notes).toHaveLength(1);
		expect(result.createdBlockIds).toHaveLength(1);
		expect(result.revision).not.toBe(beforeRevision);
		expect(test.state.projectChange).toEqual({ revision: projectRevision + 1, kind: 'edit', history: 'checkpoint' });
		expect(() => test.editing.assertCanEdit(result.revision)).not.toThrow();
	});

	it('skips unchanged API edits before notifying history or publishing a change', () => {
		const test = setup();
		const beforeEdit = vi.fn();
		test.events.on('beforeProjectEdit', beforeEdit);
		const revision = test.editing.getRevision();
		const projectRevision = test.state.projectChange.revision;
		const result = test.editing.applyEdits({
			expectedRevision: revision,
			edits: [{ type: 'update', blockId: getEditorBlockId(test.block), code: [...test.block.code] }],
		});
		expect(beforeEdit).not.toHaveBeenCalled();
		expect(test.state.projectChange.revision).toBe(projectRevision);
		expect(result.revision).toBe(revision);
	});

	it('does not capture history or schedule a history timer for ordinary edits without a plugin', async () => {
		vi.useFakeTimers();
		try {
			const { store, block, editing } = setup();
			const capture = vi.spyOn(store.projectTransactions, 'capture');
			applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: ['module target', 'int value 2', 'moduleEnd'] }]);
			const revision = editing.getRevision();
			expect(vi.getTimerCount()).toBe(0);
			await vi.advanceTimersByTimeAsync(1000);
			expect(capture).not.toHaveBeenCalled();
			expect(editing.getRevision()).toBe(revision);
			expect(block.code).toContain('int value 2');
		} finally {
			vi.useRealTimers();
		}
	});

	it('validates external edits against revision, mode and editor lifetime', () => {
		const { editing, store, events } = setup();
		const revision = editing.getRevision();
		expect(() => editing.assertCanEdit('stale')).toThrow(expect.objectContaining({ code: 'stale_revision', revision }));
		store.set('editorMode', 'view');
		expect(() => editing.assertCanEdit(revision)).toThrow(expect.objectContaining({ code: 'read_only', revision }));
		store.set('editorMode', 'edit');
		expect(() => editing.assertCanEdit(revision)).not.toThrow();
		events.dispatch('dispose');
		expect(() => editing.getRevision()).toThrow(expect.objectContaining({ code: 'disposed' }));
		expect(() => editing.assertCanEdit(revision)).toThrow(expect.objectContaining({ code: 'disposed' }));
	});
});
