import { EventEmitter } from 'node:events';
import { getProjectModules } from '@8f4e/language-spec';
import createStateManager from '@8f4e/state-manager';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditorEditingHandle, getEditorBlockId } from '../../editing';
import serializeToProject from '../../pureHelpers/projectSerialization/serializeToProject';
import { createMockCodeBlock, createMockState } from '../../pureHelpers/testingUtils/testUtils';
import rendering from '../code-blocks/effect';
import { directiveDefinitions } from '../code-blocks/features/directives/registry';
import { createLayoutRegistry } from '../code-blocks/layout/registry';
import projectOperations from './effect';

const cleanups: Array<() => void> = [];
function setup() {
	const block = createMockCodeBlock({
		blockType: 'module',
		entry: 'main',
		code: ['module target', 'int value 1', 'moduleEnd'],
	});
	const blocks = [block];
	const state = createMockState({
		editorMode: 'edit',
		featureFlags: { historyTracking: true },
		codeBlockRendering: {
			rootProject: { entries: [], path: '', blocks: blocks },
			currentProject: { entries: [], path: '', blocks: blocks },
		},
	});
	const store = createStateManager(state);
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	rendering(
		store,
		events,
		directiveDefinitions,
		createLayoutRegistry(() => {})
	);
	const disposeOperations = projectOperations(store, events);
	const editing = createEditorEditingHandle(store, events);
	cleanups.push(() => {
		editing.dispose();
		disposeOperations();
		store.dispose();
	});
	return { state, block, events, editing: editing.handle, disposeOperations };
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('project operations', () => {
	it('applies a validated API batch with no history effect installed', () => {
		const test = setup();
		const beforeEdit = vi.fn(() => serializeToProject(test.state));
		test.events.on('beforeProjectEdit', beforeEdit);
		const beforeRevision = test.editing.getRevision();
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
		expect(test.state.projectChange).toEqual({ revision: 1, kind: 'checkpoint' });
		expect(test.state.historyStack).toHaveLength(0);
	});

	it('skips unchanged API drafts before notifying history or publishing a change', () => {
		const test = setup();
		const beforeEdit = vi.fn();
		test.events.on('beforeProjectEdit', beforeEdit);
		const revision = test.editing.getRevision();
		const result = test.editing.applyEdits({
			expectedRevision: revision,
			edits: [{ type: 'update', blockId: getEditorBlockId(test.block), code: [...test.block.code] }],
		});
		expect(beforeEdit).not.toHaveBeenCalled();
		expect(test.state.projectChange.revision).toBe(0);
		expect(result.revision).toBe(revision);
	});

	it('unregisters its operation handler when disposed', () => {
		const test = setup();
		test.disposeOperations();
		expect(test.events.dispatch('applyProjectEdit', { project: serializeToProject(test.state) })).toBe(false);
	});
});
