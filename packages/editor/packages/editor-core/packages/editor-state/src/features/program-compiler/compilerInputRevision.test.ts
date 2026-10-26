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
import favoriteToggler from '../code-blocks/features/favoriteToggler/effect';
import groupDeleter from '../code-blocks/features/group/deleter/effect';
import groupNonstickToggler from '../code-blocks/features/group/nonstickToggler/effect';
import groupRemover from '../code-blocks/features/group/remover/effect';
import groupSkipExecutionToggler from '../code-blocks/features/group/skipExecutionToggler/effect';
import groupUngroupper from '../code-blocks/features/group/ungroupper/effect';
import memoryConnectionRemover from '../code-blocks/features/memoryConnectionRemover/effect';
import parsedDirectivesUpdater from '../code-blocks/features/parsedDirectivesUpdater/effect';
import projectGroupNavigation from '../code-blocks/features/projectGroupNavigation/effect';
import sliderDefaultSaver from '../code-blocks/features/sliderDefaultSaver/effect';
import codeEditing from '../code-editing/effect';
import historyTracking from '../edit-history/effect';
import globalEditorDirectivesEffect from '../global-editor-directives/effect';
import * as globalDirectiveRegistry from '../global-editor-directives/registry';
import projectImport from '../project-import/effect';
import { EMPTY_DEFAULT_PROJECT } from '../project-import/emptyDefaultProject';
import compilerEffect from './effect';

describe('compiler input revision', () => {
	let state: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let events: EventDispatcher;
	let block: ReturnType<typeof createMockCodeBlock>;
	let compileCode: ReturnType<typeof vi.fn>;
	let disposeCompiler: () => void;

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
		compileCode = vi.fn().mockRejectedValue({ message: 'Probe diagnostic', line: { lineNumber: 0 }, context: {} });
		state.callbacks.compileCode = compileCode;
		store = createStateManager(state);
		disposeCompiler = compilerEffect(store);
		events = createMockEventDispatcherWithVitest();
		events.dispatch = vi.fn(dispatch);
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
		disposeCompiler();
		store.dispose();
		vi.restoreAllMocks();
		vi.useRealTimers();
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
		state.featureFlags.editing = false;
		dispatch('insertText', { text: '2' });
		dispatch('insertNewLine');
		dispatch('deleteBackward');
		expect(state.compilerInputRevision).toBe(0);
	});

	it('ignores mouse selection, line selection, caret movement, and block navigation', async () => {
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
		expect(block.cursor.row).toBe(1);
		dispatch('moveCaret', { direction: 'down' });
		dispatch('navigateCodeBlock', { direction: 'right' });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(target);
		expect(state.compilerInputRevision).toBe(0);
		await vi.advanceTimersByTimeAsync(500);
		expect(compileCode).not.toHaveBeenCalled();

		dispatch('insertText', { text: ';' });
		await vi.advanceTimersByTimeAsync(500);
		expect(compileCode).toHaveBeenCalledTimes(1);
	});

	it('ignores dragging even though it saves a position directive in source', async () => {
		block.code.splice(1, 0, '; @pos 0 0', '; @config recompileDebounceDelay 120');
		parsedDirectivesUpdater(store);
		globalEditorDirectivesEffect(store);
		rendering(store, events);
		codeBlockDragger(store, events);
		store.set('codeBlockRendering.codeBlocks', state.codeBlockRendering.codeBlocks);
		dispatch('mousedown', { x: 32, y: 8 });
		const resolveSpy = vi.spyOn(globalDirectiveRegistry, 'resolveGlobalEditorDirectives');
		dispatch('mousemove', { movementX: 16, movementY: 32 });
		dispatch('mouseup');
		expect(block.code).toContain('; @pos 2 2');
		expect(state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBe(block);
		expect(block.parsedDirectives).toContainEqual(expect.objectContaining({ name: 'pos', args: ['2', '2'] }));
		expect(block.gridX).toBe(2);
		expect(block.gridY).toBe(2);
		expect(state.editorConfig.recompileDebounceDelay).toBe(120);
		expect(resolveSpy).not.toHaveBeenCalled();
		expect(state.compilerInputRevision).toBe(0);
		await vi.advanceTimersByTimeAsync(500);
		expect(compileCode).not.toHaveBeenCalled();
	});

	it('advances once for a mixed group execution toggle and leaves already skipped blocks unchanged', () => {
		block.groupName = 'audio';
		const skipped = createMockCodeBlock({
			code: ['module skipped', '#skipExecution', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio',
		});
		const skippedCode = skipped.code;
		state.codeBlockRendering.codeBlocks.push(skipped);
		groupSkipExecutionToggler(store, events);
		dispatch('toggleGroupSkipExecutionDirective', { codeBlock: block });
		expect(block.code).toContain('#skipExecution');
		expect(skipped.code).toBe(skippedCode);
		expect(state.compilerInputRevision).toBe(1);
		dispatch('toggleGroupSkipExecutionDirective', { codeBlock: block });
		expect([block, skipped].every(candidate => !candidate.code.includes('#skipExecution'))).toBe(true);
		expect(state.compilerInputRevision).toBe(2);
	});

	it.each([
		['toggleFavoriteDirective', favoriteToggler, {}],
		['toggleGroupNonstick', groupNonstickToggler, { makeNonstick: true }],
		['removeFromGroupDirective', groupRemover, {}],
		['ungroupByName', groupUngroupper, {}],
	])('ignores editor metadata changes from %s', async (eventName, effect, payload) => {
		block.groupName = 'audio';
		block.code.splice(1, 0, '; @group audio');
		const originalCode = [...block.code];
		effect(store, events);
		dispatch(eventName, { codeBlock: block, ...payload });
		expect(block.code).not.toEqual(originalCode);
		expect(state.compilerInputRevision).toBe(0);
		await vi.advanceTimersByTimeAsync(500);
		expect(compileCode).not.toHaveBeenCalled();
	});

	it('recompiles after adding, disabling, enabling, and deleting a block', async () => {
		codeBlockCreator(store, events);
		await dispatchAsync('addCodeBlock', { x: 100, y: 100, isNew: true, blockType: 'module' });
		expect(state.compilerInputRevision).toBe(1);
		await vi.advanceTimersByTimeAsync(500);
		expect(compileCode).toHaveBeenCalledTimes(1);
		dispatch('toggleCodeBlockDisabled', { codeBlock: block });
		expect(block.disabled).toBe(true);
		expect(state.compilerInputRevision).toBe(2);
		await vi.advanceTimersByTimeAsync(500);
		expect(compileCode).toHaveBeenCalledTimes(2);
		dispatch('toggleCodeBlockDisabled', { codeBlock: block });
		expect(block.disabled).toBe(false);
		expect(state.compilerInputRevision).toBe(3);
		await vi.advanceTimersByTimeAsync(500);
		expect(compileCode).toHaveBeenCalledTimes(3);
		dispatch('deleteCodeBlock', { codeBlock: block });
		expect(state.compilerInputRevision).toBe(4);
		await vi.advanceTimersByTimeAsync(500);
		expect(compileCode).toHaveBeenCalledTimes(4);
		dispatch('deleteCodeBlock', { codeBlock: block });
		expect(state.compilerInputRevision).toBe(4);
		await vi.advanceTimersByTimeAsync(500);
		expect(compileCode).toHaveBeenCalledTimes(4);
	});

	it('advances once for pasting several blocks and ignores an empty paste', () => {
		const blocks = ['one', 'two'].map(name => ({
			code: [`module ${name}`, 'moduleEnd'],
			gridCoordinates: { x: 0, y: 0 },
		}));
		pasteMultipleBlocks(store, { x: 0, y: 0, blocks });
		expect(state.codeBlockRendering.codeBlocks).toHaveLength(3);
		expect(state.compilerInputRevision).toBe(1);
		pasteMultipleBlocks(store, { x: 0, y: 0, blocks: [] });
		expect(state.compilerInputRevision).toBe(1);
	});

	it('advances once per group execution toggle or group deletion', () => {
		block.groupName = 'audio';
		const other = createMockCodeBlock({ code: ['module other', 'moduleEnd'], blockType: 'module', groupName: 'audio' });
		state.codeBlockRendering.codeBlocks.push(other);
		groupSkipExecutionToggler(store, events);
		groupDeleter(store, events);
		dispatch('toggleGroupSkipExecutionDirective', { codeBlock: block });
		expect([block, other].every(candidate => candidate.code.includes('#skipExecution'))).toBe(true);
		expect(state.compilerInputRevision).toBe(1);
		dispatch('deleteGroup', { codeBlock: block });
		expect(state.codeBlockRendering.codeBlocks).toHaveLength(0);
		expect(state.compilerInputRevision).toBe(2);
		dispatch('deleteGroup', { codeBlock: block });
		expect(state.compilerInputRevision).toBe(2);
	});

	it('advances when removing a memory connection, but not when there is none', () => {
		memoryConnectionRemover(store, events);
		block.code = ['module main', 'float value &other:output', 'moduleEnd'];
		dispatch('removeConnections', { codeBlock: block });
		expect(block.code[1]).toBe('float value');
		expect(state.compilerInputRevision).toBe(1);
		dispatch('removeConnections', { codeBlock: block });
		expect(state.compilerInputRevision).toBe(1);
	});

	it('advances when saving runtime defaults, but not when defaults already match', () => {
		sliderDefaultSaver(store, events);
		block.code = ['module main', 'int value 1', 'moduleEnd'];
		block.widgets.sliders = [{ moduleId: 'main', id: 'value', isInteger: true, allocationUnitAddress: 0 } as never];
		state.callbacks.getWordFromMemory = () => 2;
		dispatch('saveSliderValuesToCode', { codeBlock: block });
		expect(block.code[1]).toBe('int value 2');
		expect(state.compilerInputRevision).toBe(1);
		dispatch('saveSliderValuesToCode', { codeBlock: block });
		expect(state.compilerInputRevision).toBe(1);
	});

	it('advances for regenerated environment constants and ignores identical regeneration', () => {
		autoEnvConstants(store);
		const env = createMockCodeBlock({ name: 'env', blockType: 'constants', code: ['constants env', 'constantsEnd'] });
		state.codeBlockRendering.codeBlocks.push(env);
		store.set('binaryAssets', [{ id: 'sound', fileName: 'sound.wav', assetByteLength: 100 }]);
		expect(env.code).toContain('const ASSET_SOUND_SIZE 100');
		expect(state.compilerInputRevision).toBe(1);
		store.set('binaryAssets', state.binaryAssets);
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

	it('recompiles on project loading, undo, and redo without requiring a selected block', async () => {
		state.featureFlags.historyTracking = true;
		projectImport(store, events);
		rendering(store, events);
		historyTracking(store, events);
		dispatch('loadProject', { project: { ...EMPTY_DEFAULT_PROJECT } });
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		expect(state.compilerInputRevision).toBe(1);
		await vi.advanceTimersByTimeAsync(500);
		expect(compileCode).toHaveBeenCalledTimes(1);

		state.historyStack.push({ ...EMPTY_DEFAULT_PROJECT });
		dispatch('undo');
		expect(state.compilerInputRevision).toBe(2);
		await vi.advanceTimersByTimeAsync(500);
		expect(compileCode).toHaveBeenCalledTimes(2);

		dispatch('redo');
		expect(state.compilerInputRevision).toBe(3);
		await vi.advanceTimersByTimeAsync(500);
		expect(compileCode).toHaveBeenCalledTimes(3);
	});
});
