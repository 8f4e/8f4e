import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import createDefaultState from '../../pureHelpers/state/createDefaultState';
import { deleteCodeBlocks } from '../code-blocks/deleteCodeBlocks';
import rendering from '../code-blocks/effect';
import autoEnvConstants from '../code-blocks/features/auto-env-constants/effect';
import codeBlockActions from '../code-blocks/features/codeBlockActions/effect';
import codeBlockDragger from '../code-blocks/features/codeBlockDragger/effect';
import codeBlockNavigation from '../code-blocks/features/codeBlockNavigation/effect';
import { directiveDefinitions } from '../code-blocks/features/directives/registry';
import projectGroupNavigation from '../code-blocks/features/projectGroupNavigation/effect';
import { insertCodeBlocks } from '../code-blocks/insertCodeBlocks';
import { createLayoutRegistry } from '../code-blocks/layout/registry';
import { applyCodeBlockSourceEdits } from '../code-blocks/sourceEdits';
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
			cursor: { row: 1, col: 6, y: 16 },
		});
		state.codeBlockRendering.rootProject.blocks.push(block);
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

	it('announces changed source batches and ignores identical source', () => {
		const sources: string[][] = [];
		store.subscribe('compilerInputRevision', () => sources.push([...block.code]));
		const code = ['module main', 'push 12', 'drop', 'moduleEnd'];
		applyCodeBlockSourceEdits({ store, events }, [{ codeBlock: block, code }], { affectsCompilation: true });
		expect(state.compilerInputRevision).toBe(1);
		expect(sources).toEqual([code]);
		applyCodeBlockSourceEdits({ store, events }, [{ codeBlock: block, code: [...code] }], { affectsCompilation: true });
		expect(state.compilerInputRevision).toBe(1);
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
		const target = createMockCodeBlock({ code: ['module target', 'moduleEnd'], x: 400, blockType: 'module' });
		state.codeBlockRendering.currentProject.blocks.push(target);
		dispatch('pointerdown', { x: 32, y: 8 });
		dispatch('pointerup');
		dispatch('pointerdown', { x: 32, y: 24 });
		dispatch('pointerup');
		expect(block.cursor.row).toBe(1);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 2);
		dispatch('navigateCodeBlock', { direction: 'right' });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(target);
		expect(state.compilerInputRevision).toBe(0);
		expect(onInputChanged).not.toHaveBeenCalled();

		applyCodeBlockSourceEdits(
			{ store, events },
			[{ codeBlock: target, code: ['module target', '; edited', 'moduleEnd'] }],
			{
				affectsCompilation: true,
			}
		);
		expect(onInputChanged).toHaveBeenCalledTimes(1);
	});

	it('ignores dragging that preserves block order even though it saves a position directive in source', () => {
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
		store.set('codeBlockRendering.currentProject.blocks', state.codeBlockRendering.currentProject.blocks);
		dispatch('pointerdown', { x: 32, y: 8 });
		dispatch('pointermove', { movementX: 16, movementY: 32 });
		dispatch('pointerup');
		expect(block.code).toContain('; @pos 2 2');
		expect(block.parsedDirectives).toContainEqual(expect.objectContaining({ name: 'pos', args: ['2', '2'] }));
		expect(block.gridX).toBe(2);
		expect(block.gridY).toBe(2);
		expect(state.editorConfig.example).toBe(120);
		expect(state.compilerInputRevision).toBe(0);
		expect(onInputChanged).not.toHaveBeenCalled();
	});

	it('announces changes after adding, disabling, enabling, and deleting a block', async () => {
		codeBlockActions(store, events);
		await dispatchAsync('insertCodeBlock', { x: 100, y: 100, code: ['module added', 'moduleEnd'] });
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
		deleteCodeBlocks(store, [block]);
		expect(state.compilerInputRevision).toBe(4);
		expect(onInputChanged).toHaveBeenCalledTimes(4);
		deleteCodeBlocks(store, [block]);
		expect(state.compilerInputRevision).toBe(4);
		expect(onInputChanged).toHaveBeenCalledTimes(4);
	});

	it('advances once for inserting a block batch and ignores an empty batch', () => {
		const blocks = ['one', 'two'].map(name => ({
			code: [`module ${name}`, 'moduleEnd'],
			gridCoordinates: { x: 0, y: 0 },
		}));
		insertCodeBlocks(store, { x: 0, y: 0, blocks });
		expect(state.codeBlockRendering.currentProject.blocks).toHaveLength(3);
		expect(state.compilerInputRevision).toBe(1);
		insertCodeBlocks(store, { x: 0, y: 0, blocks: [] });
		expect(state.compilerInputRevision).toBe(1);
	});

	it('advances for regenerated environment constants and ignores identical regeneration', () => {
		autoEnvConstants(store, events);
		const env = createMockCodeBlock({ name: 'env', blockType: 'constants', code: ['constants env', 'constantsEnd'] });
		state.codeBlockRendering.currentProject.blocks.push(env);
		store.set('envConstantContributions.test', ['const CONTRIBUTED_VALUE 100']);
		expect(env.code).toContain('const CONTRIBUTED_VALUE 100');
		expect(state.compilerInputRevision).toBe(1);
		store.set('envConstantContributions', state.envConstantContributions);
		expect(state.compilerInputRevision).toBe(1);
	});

	it('ignores opening and leaving a nested project, but advances for edits inside it', () => {
		const child = createMockCodeBlock({ code: ['module child', 'moduleEnd'] });
		block.childProject = { entries: [], path: 'Audio', blocks: [child] };
		projectGroupNavigation(store, events);
		dispatch('openProjectGroup', { codeBlock: block });
		store.set('codeBlockRendering.selectedCodeBlock', child);
		expect(state.compilerInputRevision).toBe(0);
		applyCodeBlockSourceEdits(
			{ store, events },
			[{ codeBlock: child, code: ['module child', '; edited', 'moduleEnd'] }],
			{
				affectsCompilation: true,
			}
		);
		expect(state.compilerInputRevision).toBe(1);
		dispatch('goToParentProjectGroup');
		expect(state.codeBlockRendering.currentProject.blocks).toBe(state.codeBlockRendering.rootProject.blocks);
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
