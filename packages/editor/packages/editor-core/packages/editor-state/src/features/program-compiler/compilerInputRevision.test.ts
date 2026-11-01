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
import historyTracking from '../edit-history/effect';
import { createSchemaEditorConfigValidator } from '../editor-config/schemaValidator';
import projectLoading from '../project-loading/effect';
import { EMPTY_DEFAULT_PROJECT } from '../project-loading/emptyDefaultProject';
import publishCompilationInputChanges from './inputChanges';

describe('compiler input revision', () => {
	let state: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let events: EventDispatcher;
	let block: ReturnType<typeof createMockCodeBlock>;
	let onInputChanged: ReturnType<typeof vi.fn>;
	let disposePublisher: () => void;

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
		state = createMockState();
		onInputChanged = vi.fn();
		store = createStateManager(state);
		events = createMockEventDispatcherWithVitest();
		events.dispatch = vi.fn(dispatch);
		disposePublisher = publishCompilationInputChanges(store, events);
		events.on('compilationInputChanged', onInputChanged);
		block = createMockCodeBlock({
			name: 'main',
			code: ['module main', 'push 1', 'drop', 'moduleEnd'],
			blockType: 'module',
			cursor: { row: 1, col: 6, x: 0, y: 16 },
		});
		state.codeBlockRendering.rootCodeBlocks.push(block);
		state.codeBlockRendering.selectedCodeBlock = block;
	});

	afterEach(() => {
		disposePublisher();
		store.dispose();
		vi.restoreAllMocks();
	});

	it('starts at zero', () => {
		expect(createDefaultState().compilerInputRevision).toBe(0);
		expect(state.compilerInputRevision).toBe(0);
	});

	it('advances for typing, newline insertion, and deletion, after the source update', () => {
		codeEditing(store, events);
		const sources: string[][] = [];
		store.subscribe('compilerInputRevision', () => sources.push([...block.code]));

		dispatch('insertText', { text: '2' });
		expect(state.compilerInputRevision).toBe(1);
		expect(sources[0][1]).toBe('push 12');
		dispatch('deleteBackward');
		expect(state.compilerInputRevision).toBe(2);
		expect(sources[1][1]).toBe('push 1');
		dispatch('insertNewLine');
		expect(state.compilerInputRevision).toBe(3);
		expect(sources[2]).toHaveLength(5);
	});

	it('ignores empty insertion and backspace at the start of the block', () => {
		codeEditing(store, events);
		block.cursor.row = 0;
		block.cursor.col = 0;
		dispatch('deleteBackward');
		dispatch('insertText', { text: '' });
		expect(state.compilerInputRevision).toBe(0);
	});

	it('ignores editing actions while editing is disabled', () => {
		codeEditing(store, events);
		state.editorMode = 'view';
		dispatch('insertText', { text: '2' });
		dispatch('insertNewLine');
		dispatch('deleteBackward');
		expect(state.compilerInputRevision).toBe(0);
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
		state.codeBlockRendering.codeBlocks.push(target);
		dispatch('mousedown', { x: 32, y: 8 });
		dispatch('mouseup');
		dispatch('mousedown', { x: 32, y: 24 });
		dispatch('mouseup');
		expect(block.cursor.row).toBe(1);
		dispatch('moveCaret', { direction: 'down' });
		dispatch('navigateCodeBlock', { direction: 'right' });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(target);
		expect(state.compilerInputRevision).toBe(0);
		expect(onInputChanged).not.toHaveBeenCalled();

		dispatch('insertText', { text: ';' });
		expect(onInputChanged).toHaveBeenCalledTimes(1);
	});

	it('ignores dragging even though it saves a position directive in source', () => {
		store.set(
			'editorConfigValidators.example',
			createSchemaEditorConfigValidator({ root: 'example', schema: { type: 'integer' } })
		);
		block.code.splice(1, 0, '; @pos 0 0', '; @config example 120');
		rendering(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		codeBlockDragger(store, events);
		store.set('codeBlockRendering.codeBlocks', state.codeBlockRendering.codeBlocks);
		dispatch('mousedown', { x: 32, y: 8 });
		dispatch('mousemove', { movementX: 16, movementY: 32 });
		dispatch('mouseup');
		expect(block.code).toContain('; @pos 2 2');
		expect(state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBe(block);
		expect(block.parsedDirectives).toContainEqual(expect.objectContaining({ name: 'pos', args: ['2', '2'] }));
		expect(block.gridX).toBe(2);
		expect(block.gridY).toBe(2);
		expect(state.editorConfig.example).toBe(120);
		expect(state.compilerInputRevision).toBe(0);
		expect(onInputChanged).not.toHaveBeenCalled();
	});

	it('announces changes after adding, disabling, enabling, and deleting a block', async () => {
		codeBlockCreator(store, events);
		await dispatchAsync('createCodeBlock', { x: 100, y: 100, blockType: 'module' });
		expect(state.compilerInputRevision).toBe(1);
		expect(onInputChanged).toHaveBeenCalledTimes(1);
		dispatch('toggleCodeBlockDisabled', { codeBlock: block });
		expect(block.disabled).toBe(true);
		expect(state.compilerInputRevision).toBe(2);
		expect(onInputChanged).toHaveBeenCalledTimes(2);
		dispatch('toggleCodeBlockDisabled', { codeBlock: block });
		expect(block.disabled).toBe(false);
		expect(state.compilerInputRevision).toBe(3);
		expect(onInputChanged).toHaveBeenCalledTimes(3);
		dispatch('deleteCodeBlock', { codeBlock: block });
		expect(state.compilerInputRevision).toBe(4);
		expect(onInputChanged).toHaveBeenCalledTimes(4);
		dispatch('deleteCodeBlock', { codeBlock: block });
		expect(state.compilerInputRevision).toBe(4);
		expect(onInputChanged).toHaveBeenCalledTimes(4);
	});

	it('advances once for pasting several blocks and ignores an empty paste', () => {
		const blocks = ['one', 'two'].map(name => ({
			code: [`module ${name}`, 'moduleEnd'],
			gridCoordinates: { x: 0, y: 0 },
		}));
		pasteMultipleBlocks(store, events, { x: 0, y: 0, blocks });
		expect(state.codeBlockRendering.codeBlocks).toHaveLength(3);
		expect(state.compilerInputRevision).toBe(1);
		pasteMultipleBlocks(store, events, { x: 0, y: 0, blocks: [] });
		expect(state.compilerInputRevision).toBe(1);
	});

	it('advances for regenerated environment constants and ignores identical regeneration', () => {
		autoEnvConstants(store);
		const env = createMockCodeBlock({ name: 'env', blockType: 'constants', code: ['constants env', 'constantsEnd'] });
		state.codeBlockRendering.codeBlocks.push(env);
		store.set('envConstantContributions.test', ['const CONTRIBUTED_VALUE 100']);
		expect(env.code).toContain('const CONTRIBUTED_VALUE 100');
		expect(state.compilerInputRevision).toBe(1);
		store.set('envConstantContributions', state.envConstantContributions);
		expect(state.compilerInputRevision).toBe(1);
	});

	it('ignores opening and leaving a nested project, but advances for edits inside it', () => {
		const child = createMockCodeBlock({ code: ['module child', 'moduleEnd'] });
		block.nestedProjectCodeBlocks = [child];
		projectGroupNavigation(store, events);
		codeEditing(store, events);
		dispatch('openProjectGroup', { codeBlock: block });
		store.set('codeBlockRendering.selectedCodeBlock', child);
		expect(state.compilerInputRevision).toBe(0);
		dispatch('insertText', { text: ';' });
		expect(state.compilerInputRevision).toBe(1);
		dispatch('goToParentProjectGroup');
		expect(state.codeBlockRendering.codeBlocks).toBe(state.codeBlockRendering.rootCodeBlocks);
		expect(state.compilerInputRevision).toBe(1);
	});

	it('announces project loading, undo, and redo without requiring a selected block', () => {
		state.featureFlags.historyTracking = true;
		projectLoading(store, events);
		rendering(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		historyTracking(store, events);
		dispatch('loadProject', { project: { ...EMPTY_DEFAULT_PROJECT } });
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		expect(state.compilerInputRevision).toBe(1);
		expect(onInputChanged).toHaveBeenCalledTimes(1);

		state.historyStack.push({ ...EMPTY_DEFAULT_PROJECT });
		dispatch('undo');
		expect(state.compilerInputRevision).toBe(2);
		expect(onInputChanged).toHaveBeenCalledTimes(2);

		dispatch('redo');
		expect(state.compilerInputRevision).toBe(3);
		expect(onInputChanged).toHaveBeenCalledTimes(3);
	});
});
