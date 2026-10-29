import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import createDefaultState from '../../pureHelpers/state/createDefaultState';
import rendering from '../code-blocks/effect';
import autoEnvConstants from '../code-blocks/features/auto-env-constants/effect';
import codeBlockCreator from '../code-blocks/features/codeBlockCreator/effect';
import { pasteMultipleBlocks } from '../code-blocks/features/codeBlockCreator/pasteMultipleBlocks';
import codeBlockDragger from '../code-blocks/features/codeBlockDragger/effect';
import codeBlockNavigation from '../code-blocks/features/codeBlockNavigation/effect';
import groupDeleter from '../code-blocks/features/group/deleter/effect';
import groupNonstickToggler from '../code-blocks/features/group/nonstickToggler/effect';
import groupRemover from '../code-blocks/features/group/remover/effect';
import groupSkipExecutionToggler from '../code-blocks/features/group/skipExecutionToggler/effect';
import groupUngroupper from '../code-blocks/features/group/ungroupper/effect';
import parsedDirectivesUpdater from '../code-blocks/features/parsedDirectivesUpdater/effect';
import projectGroupNavigation from '../code-blocks/features/projectGroupNavigation/effect';
import codeEditing from '../code-editing/effect';
import globalEditorDirectivesEffect from '../global-editor-directives/effect';
import projectImport from '../project-loading/effect';
import { EMPTY_DEFAULT_PROJECT } from '../project-loading/emptyDefaultProject';

describe('project revision', () => {
	let state: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let events: EventDispatcher;
	let block: ReturnType<typeof createMockCodeBlock>;

	function dispatch(name: string, payload: unknown = {}): void {
		for (const [eventName, handler] of vi.mocked(events.on).mock.calls) {
			if (eventName === name) handler(payload);
		}
	}

	async function dispatchAsync(name: string, payload: unknown): Promise<void> {
		await Promise.all(
			vi
				.mocked(events.on)
				.mock.calls.filter(([eventName]) => eventName === name)
				.map(([, handler]) => handler(payload))
		);
	}

	beforeEach(() => {
		vi.useFakeTimers();
		state = createMockState();
		store = createStateManager(state);
		events = createMockEventDispatcherWithVitest();
		events.dispatch = vi.fn(dispatch);
		block = createMockCodeBlock({
			name: 'main',
			code: ['module main', 'push 1', 'drop', 'moduleEnd'],
			blockType: 'module',
			cursor: { row: 1, col: 6, x: 0, y: 16 },
		});
		state.codeBlockRendering.rootCodeBlocks.push(block);
		state.codeBlockRendering.codeBlocks = state.codeBlockRendering.rootCodeBlocks;
		state.codeBlockRendering.selectedCodeBlock = block;
	});

	afterEach(() => {
		store.dispose();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('starts at zero', () => {
		expect(createDefaultState().projectRevision).toBe(0);
		expect(state.projectRevision).toBe(0);
	});

	it('advances for typing, newline insertion, and deletion', () => {
		codeEditing(store, events);
		dispatch('insertText', { text: '2' });
		expect(state.projectRevision).toBe(1);
		dispatch('deleteBackward');
		expect(state.projectRevision).toBe(2);
		dispatch('insertNewLine');
		expect(state.projectRevision).toBe(3);
	});

	it('ignores empty insertion and backspace at the start of the block', () => {
		codeEditing(store, events);
		block.cursor.row = 0;
		block.cursor.col = 0;
		dispatch('deleteBackward');
		dispatch('insertText', { text: '' });
		expect(state.projectRevision).toBe(0);
	});

	it('ignores mouse selection, line selection, caret movement, and block navigation', () => {
		rendering(store, events);
		codeBlockDragger(store, events);
		codeBlockNavigation(store, events);
		codeEditing(store, events);
		const target = createMockCodeBlock({ code: ['module target', 'moduleEnd'], x: 400, blockType: 'module' });
		state.codeBlockRendering.codeBlocks.push(target);
		dispatch('mousedown', { x: 32, y: 8 });
		dispatch('mouseup');
		dispatch('mousedown', { x: 32, y: 24 });
		dispatch('mouseup');
		dispatch('moveCaret', { direction: 'down' });
		dispatch('navigateCodeBlock', { direction: 'right' });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(target);
		expect(state.projectRevision).toBe(0);
	});

	it('advances once for a drag position commit, without advancing the compiler revision', () => {
		block.code.splice(1, 0, '; @pos 0 0');
		parsedDirectivesUpdater(store);
		globalEditorDirectivesEffect(store);
		rendering(store, events);
		codeBlockDragger(store, events);
		store.set('codeBlockRendering.codeBlocks', state.codeBlockRendering.codeBlocks);
		dispatch('mousedown', { x: 32, y: 8 });
		dispatch('mousemove', { movementX: 16, movementY: 32 });
		dispatch('mouseup');
		expect(block.code).toContain('; @pos 2 2');
		expect(state.projectRevision).toBe(1);
		expect(state.compilerInputRevision).toBe(0);
	});

	it.each([
		['toggleGroupNonstick', groupNonstickToggler, { makeNonstick: true }],
		['removeFromGroupDirective', groupRemover, {}],
		['ungroupByName', groupUngroupper, {}],
	])('advances for editor metadata changes from %s, unlike the compiler revision', (eventName, effect, payload) => {
		block.groupName = 'audio';
		block.code.splice(1, 0, '; @group audio');
		const originalCode = [...block.code];
		effect(store, events);
		dispatch(eventName, { codeBlock: block, ...payload });
		expect(block.code).not.toEqual(originalCode);
		expect(state.projectRevision).toBe(1);
		expect(state.compilerInputRevision).toBe(0);
	});

	it('advances for adding, disabling, enabling, and deleting a block, but not for a repeated delete', async () => {
		codeBlockCreator(store, events);
		await dispatchAsync('insertCodeBlock', { x: 100, y: 100, code: ['module added', 'moduleEnd'] });
		expect(state.projectRevision).toBe(1);
		dispatch('toggleCodeBlockDisabled', { codeBlock: block });
		expect(state.projectRevision).toBe(2);
		dispatch('toggleCodeBlockDisabled', { codeBlock: block });
		expect(state.projectRevision).toBe(3);
		dispatch('deleteCodeBlock', { codeBlock: block });
		expect(state.projectRevision).toBe(4);
		dispatch('deleteCodeBlock', { codeBlock: block });
		expect(state.projectRevision).toBe(4);
	});

	it('advances once for pasting several blocks and ignores an empty paste', () => {
		const blocks = ['one', 'two'].map(name => ({
			code: [`module ${name}`, 'moduleEnd'],
			gridCoordinates: { x: 0, y: 0 },
		}));
		pasteMultipleBlocks(store, { x: 0, y: 0, blocks });
		expect(state.codeBlockRendering.codeBlocks).toHaveLength(3);
		expect(state.projectRevision).toBe(1);
		pasteMultipleBlocks(store, { x: 0, y: 0, blocks: [] });
		expect(state.projectRevision).toBe(1);
	});

	it('advances once per group execution toggle or group deletion', () => {
		block.groupName = 'audio';
		const other = createMockCodeBlock({ code: ['module other', 'moduleEnd'], blockType: 'module', groupName: 'audio' });
		state.codeBlockRendering.codeBlocks.push(other);
		groupSkipExecutionToggler(store, events);
		groupDeleter(store, events);
		dispatch('toggleGroupSkipExecutionDirective', { codeBlock: block });
		expect(state.projectRevision).toBe(1);
		dispatch('deleteGroup', { codeBlock: block });
		expect(state.codeBlockRendering.codeBlocks).toHaveLength(0);
		expect(state.projectRevision).toBe(2);
		dispatch('deleteGroup', { codeBlock: block });
		expect(state.projectRevision).toBe(2);
	});

	it('advances for regenerated environment constants and ignores identical regeneration', () => {
		autoEnvConstants(store);
		const env = createMockCodeBlock({ name: 'env', blockType: 'constants', code: ['constants env', 'constantsEnd'] });
		state.codeBlockRendering.codeBlocks.push(env);
		store.set('envConstantContributions', { assets: ['const SOUND_SIZE 100'] });
		expect(state.projectRevision).toBe(1);
		store.set('envConstantContributions', state.envConstantContributions);
		expect(state.projectRevision).toBe(1);
	});

	it('does not advance for opening and leaving a nested project, but advances for edits inside it', () => {
		const child = createMockCodeBlock({ code: ['module child', 'moduleEnd'] });
		block.nestedProjectCodeBlocks = [child];
		projectGroupNavigation(store, events);
		codeEditing(store, events);
		dispatch('openProjectGroup', { codeBlock: block });
		store.set('codeBlockRendering.selectedCodeBlock', child);
		expect(state.projectRevision).toBe(0);
		dispatch('insertText', { text: ';' });
		expect(state.projectRevision).toBe(1);
		dispatch('goToParentProjectGroup');
		expect(state.projectRevision).toBe(1);
	});

	it('does not advance on project loading, while the compiler revision does', () => {
		projectImport(store, events);
		rendering(store, events);
		dispatch('loadProject', { project: { ...EMPTY_DEFAULT_PROJECT } });
		expect(state.projectRevision).toBe(0);
		expect(state.compilerInputRevision).toBe(1);
	});
});
