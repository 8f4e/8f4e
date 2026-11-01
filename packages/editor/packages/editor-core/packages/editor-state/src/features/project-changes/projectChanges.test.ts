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
import { directiveDefinitions } from '../code-blocks/features/directives/registry';
import projectGroupNavigation from '../code-blocks/features/projectGroupNavigation/effect';
import { createLayoutRegistry } from '../code-blocks/layout/registry';
import codeEditing from '../code-editing/effect';
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
		state.codeBlockRendering.rootProject.blocks.push(block);
		state.codeBlockRendering.currentProject.blocks = state.codeBlockRendering.rootProject.blocks;
		state.codeBlockRendering.selectedCodeBlock = block;
	});

	afterEach(() => {
		store.dispose();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('starts at zero', () => {
		expect(createDefaultState().projectChange.revision).toBe(0);
		expect(state.projectChange.revision).toBe(0);
	});

	it('advances for typing, newline insertion, and deletion', () => {
		codeEditing(store, events);
		dispatch('insertText', { text: '2' });
		expect(state.projectChange.revision).toBe(1);
		dispatch('deleteBackward');
		expect(state.projectChange.revision).toBe(2);
		dispatch('insertNewLine');
		expect(state.projectChange.revision).toBe(3);
	});

	it('ignores empty insertion and backspace at the start of the block', () => {
		codeEditing(store, events);
		block.cursor.row = 0;
		block.cursor.col = 0;
		dispatch('deleteBackward');
		dispatch('insertText', { text: '' });
		expect(state.projectChange.revision).toBe(0);
	});

	it('ignores mouse selection, line selection, caret movement, and block navigation', () => {
		rendering(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		codeBlockDragger(store, events);
		codeBlockNavigation(store, events);
		codeEditing(store, events);
		const target = createMockCodeBlock({ code: ['module target', 'moduleEnd'], x: 400, blockType: 'module' });
		state.codeBlockRendering.currentProject.blocks.push(target);
		dispatch('mousedown', { x: 32, y: 8 });
		dispatch('mouseup');
		dispatch('mousedown', { x: 32, y: 24 });
		dispatch('mouseup');
		dispatch('moveCaret', { direction: 'down' });
		dispatch('navigateCodeBlock', { direction: 'right' });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(target);
		expect(state.projectChange.revision).toBe(0);
	});

	it('advances once for a drag position commit, without advancing the compiler revision', () => {
		block.code.splice(1, 0, '; @pos 0 0');
		rendering(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		codeBlockDragger(store, events);
		store.set('codeBlockRendering.currentProject.blocks', state.codeBlockRendering.currentProject.blocks);
		dispatch('mousedown', { x: 32, y: 8 });
		dispatch('mousemove', { movementX: 16, movementY: 32 });
		dispatch('mouseup');
		expect(block.code).toContain('; @pos 2 2');
		expect(state.projectChange.revision).toBe(1);
		expect(state.compilerInputRevision).toBe(0);
	});

	it('advances for adding, disabling, enabling, and deleting a block, but not for a repeated delete', async () => {
		codeBlockCreator(store, events);
		await dispatchAsync('insertCodeBlock', { x: 100, y: 100, code: ['module added', 'moduleEnd'] });
		expect(state.projectChange.revision).toBe(1);
		dispatch('toggleCodeBlockDisabled', { codeBlock: block });
		expect(state.projectChange.revision).toBe(2);
		dispatch('toggleCodeBlockDisabled', { codeBlock: block });
		expect(state.projectChange.revision).toBe(3);
		dispatch('deleteCodeBlock', { codeBlock: block });
		expect(state.projectChange.revision).toBe(4);
		dispatch('deleteCodeBlock', { codeBlock: block });
		expect(state.projectChange.revision).toBe(4);
	});

	it('advances once for pasting several blocks and ignores an empty paste', () => {
		const blocks = ['one', 'two'].map(name => ({
			code: [`module ${name}`, 'moduleEnd'],
			gridCoordinates: { x: 0, y: 0 },
		}));
		pasteMultipleBlocks(store, events, { x: 0, y: 0, blocks });
		expect(state.codeBlockRendering.currentProject.blocks).toHaveLength(3);
		expect(state.projectChange.revision).toBe(1);
		pasteMultipleBlocks(store, events, { x: 0, y: 0, blocks: [] });
		expect(state.projectChange.revision).toBe(1);
	});

	it('advances for regenerated environment constants and ignores identical regeneration', () => {
		autoEnvConstants(store);
		const env = createMockCodeBlock({ name: 'env', blockType: 'constants', code: ['constants env', 'constantsEnd'] });
		state.codeBlockRendering.currentProject.blocks.push(env);
		store.set('envConstantContributions', { assets: ['const SOUND_SIZE 100'] });
		expect(state.projectChange.revision).toBe(1);
		store.set('envConstantContributions', state.envConstantContributions);
		expect(state.projectChange.revision).toBe(1);
	});

	it('does not advance for opening and leaving a nested project, but advances for edits inside it', () => {
		const child = createMockCodeBlock({ code: ['module child', 'moduleEnd'] });
		block.childProject = { path: 'Audio', blocks: [child] };
		projectGroupNavigation(store, events);
		codeEditing(store, events);
		dispatch('openProjectGroup', { codeBlock: block });
		store.set('codeBlockRendering.selectedCodeBlock', child);
		expect(state.projectChange.revision).toBe(0);
		dispatch('insertText', { text: ';' });
		expect(state.projectChange.revision).toBe(1);
		dispatch('goToParentProjectGroup');
		expect(state.projectChange.revision).toBe(1);
	});

	it('publishes project replacement separately from the compiler signal', () => {
		projectImport(store, events);
		rendering(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		dispatch('loadProject', { project: { ...EMPTY_DEFAULT_PROJECT } });
		expect(state.projectChange).toEqual({ revision: 1, kind: 'replace' });
		expect(state.compilerInputRevision).toBe(1);
	});
});
