import { EventEmitter } from 'node:events';
import { getProjectModules } from '@8f4e/language-spec';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import initState from '../index';
import serializeToProject from '../pureHelpers/projectSerialization/serializeToProject';
import { createEditorEditingHandle, getEditorBlockId } from './index';

const cleanups: Array<() => void> = [];
function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, featureFlags: { historyTracking: false } });
	const state = store.getState();
	events.dispatch('loadProject', {
		project: parseProjectSource('8f4e/v1\nentry main\nmodule target\nint value 1\nmoduleEnd\nentryEnd'),
	});
	events.dispatch('enterEditMode');
	const block = state.codeBlockRendering.rootProject.blocks.find(candidate => candidate.name === 'target')!;
	const editing = createEditorEditingHandle(store, events);
	cleanups.push(() => {
		editing.dispose();
		store.dispose();
	});
	return { state, block, events, editing: editing.handle };
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('public editor operations without history', () => {
	it('applies a validated API batch with history tracking disabled', () => {
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
		expect(test.state.projectChange).toEqual({ revision: projectRevision + 1, kind: 'checkpoint' });
		expect(test.state.historyStack).toHaveLength(0);
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
});
