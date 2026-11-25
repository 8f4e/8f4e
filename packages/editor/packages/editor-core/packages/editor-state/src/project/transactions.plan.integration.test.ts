import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, expect, it, vi } from 'vitest';
import initState, { createEditorCommandApi, getEditorBlockId, serializeToProject } from '~/index';

const disposers: Array<() => void> = [];
afterEach(() => {
	while (disposers.length) disposers.pop()!();
});

function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	const { handle: editing, dispose } = createEditorCommandApi(store, events);
	disposers.push(store.dispose, dispose);
	events.dispatch('loadProject', {
		project: parseProjectSource(
			'8f4e/v1\nentry main\ngroup child\nentry main\nmodule member\nmoduleEnd\nentryEnd\ngroupEnd\nentryEnd'
		),
	});
	events.dispatch('enterEditMode');
	const group = state.project.rootLevel.blocks.find(block => block.name === 'child')!;
	const member = group.childLevel!.blocks[0];
	const beforeEdit = vi.fn();
	const compilationChanged = vi.fn();
	events.on('beforeProjectEdit', beforeEdit);
	store.subscribe('compilerInputRevision', compilationChanged);
	return { store, state, editing, group, member, beforeEdit, compilationChanged };
}

it.each(['public commands', 'plugin plans'] as const)('settles deletion conflicts consistently through %s', surface => {
	const { store, state, editing, group, member, beforeEdit, compilationChanged } = setup();
	const revision = state.projectChange.revision;
	const compilerRevision = state.compilerInputRevision;
	const expectedRevision = editing.getRevision();
	const original = serializeToProject(state);
	const blockId = getEditorBlockId(member);
	const groupId = getEditorBlockId(group);
	const code = ['module changed', 'moduleEnd'];
	const insertedCode = ['note added', 'noteEnd'];

	if (surface === 'public commands') {
		expect(() =>
			editing.applyEdits({
				expectedRevision,
				edits: [
					{ type: 'update', blockId, code },
					{ type: 'delete', blockId: groupId },
				],
			})
		).toThrow(
			expect.objectContaining({
				code: 'invalid_edit',
				message: 'Cannot update a block being deleted',
				revision: expectedRevision,
			})
		);
		expect(() =>
			editing.applyEdits({
				expectedRevision,
				edits: [
					{ type: 'insert', groupBlockId: groupId, code: insertedCode },
					{ type: 'delete', blockId: groupId },
				],
			})
		).toThrow(
			expect.objectContaining({
				code: 'invalid_edit',
				message: 'Cannot insert into a project group being deleted',
				revision: expectedRevision,
			})
		);
	} else {
		expect(() =>
			store.projectTransactions.apply(
				{ updates: [{ codeBlock: member, code }], deletes: [group] },
				{ history: 'checkpoint' }
			)
		).toThrow(expect.objectContaining({ code: 'deleted_block', message: 'Cannot update a block being deleted' }));
		expect(() =>
			store.projectTransactions.apply(
				{ inserts: [{ targetLevel: group.childLevel!, source: { code: insertedCode } }], deletes: [group] },
				{ history: 'checkpoint' }
			)
		).toThrow(
			expect.objectContaining({ code: 'deleted_project', message: 'Cannot insert into a project group being deleted' })
		);
	}
	expect(state.projectChange.revision).toBe(revision);
	expect(state.compilerInputRevision).toBe(compilerRevision);
	expect(serializeToProject(state)).toEqual(original);
	expect(beforeEdit).not.toHaveBeenCalled();
	expect(compilationChanged).not.toHaveBeenCalled();

	if (surface === 'public commands') {
		editing.applyEdits({
			expectedRevision,
			edits: [
				{ type: 'delete', blockId },
				{ type: 'delete', blockId: groupId },
				{ type: 'delete', blockId: groupId },
			],
		});
	} else {
		expect(
			store.projectTransactions.apply({ deletes: [member, group, group] }, { history: 'checkpoint' }).changed
		).toBe(true);
	}
	expect(state.project.rootLevel.blocks).not.toContain(group);
	expect(state.projectChange.revision).toBe(revision + 1);
	expect(state.compilerInputRevision).toBe(compilerRevision + 1);
	expect(beforeEdit).toHaveBeenCalledOnce();
	expect(compilationChanged).toHaveBeenCalledOnce();
});

it('settles explicit entry metadata against the final repeated source update', () => {
	const { editing, member, group } = setup();
	const blockId = getEditorBlockId(member);
	editing.applyEdits({
		expectedRevision: editing.getRevision(),
		edits: [
			{ type: 'update', blockId, code: ['module intermediate', 'moduleEnd'], entry: 'transient' },
			{ type: 'update', blockId, code: ['note final', 'noteEnd'] },
		],
	});
	expect(member.entry).toBeUndefined();
	expect(group.childLevel!.entries).toEqual(['main']);
	editing.applyEdits({
		expectedRevision: editing.getRevision(),
		edits: [
			{ type: 'update', blockId, code: ['module intermediate', 'moduleEnd'], entry: 'alternate' },
			{ type: 'update', blockId, code: ['note intermediate', 'noteEnd'] },
			{ type: 'update', blockId, code: ['module final', 'moduleEnd'] },
		],
	});
	expect(member.entry).toBe('alternate');
	expect(group.childLevel!.entries).toEqual(['main', 'alternate']);
});
