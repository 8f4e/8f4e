import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import createDefaultState from '../../pureHelpers/state/createDefaultState';
import rendering from '../code-blocks/effect';
import autoEnvConstants from '../code-blocks/features/auto-env-constants/effect';
import codeBlockCreator from '../code-blocks/features/codeBlockCreator/effect';
import codeBlockDragger from '../code-blocks/features/codeBlockDragger/effect';
import codeBlockNavigation from '../code-blocks/features/codeBlockNavigation/effect';
import { directiveDefinitions } from '../code-blocks/features/directives/registry';
import projectGroupNavigation from '../code-blocks/features/projectGroupNavigation/effect';
import { insertCodeBlocks } from '../code-blocks/insertCodeBlocks';
import { createLayoutRegistry } from '../code-blocks/layout/registry';
import { applyCodeBlockSourceEdits } from '../code-blocks/sourceEdits';
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
			cursor: { row: 1, col: 6, y: 16 },
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

	it('announces changed source batches and ignores identical source', () => {
		const code = ['module main', 'push 12', 'drop', 'moduleEnd'];
		applyCodeBlockSourceEdits(store, [{ codeBlock: block, code }], { affectsCompilation: true });
		expect(state.projectChange.revision).toBe(1);
		applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: [...code] }], { affectsCompilation: true });
		expect(state.projectChange.revision).toBe(1);
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
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 2);
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
		dispatch('pointerdown', { x: 32, y: 8 });
		dispatch('pointermove', { movementX: 16, movementY: 32 });
		dispatch('pointerup');
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

	it('advances once for inserting a block batch and ignores an empty batch', () => {
		const blocks = ['one', 'two'].map(name => ({
			code: [`module ${name}`, 'moduleEnd'],
			gridCoordinates: { x: 0, y: 0 },
		}));
		insertCodeBlocks(store, { x: 0, y: 0, blocks });
		expect(state.codeBlockRendering.currentProject.blocks).toHaveLength(3);
		expect(state.projectChange.revision).toBe(1);
		insertCodeBlocks(store, { x: 0, y: 0, blocks: [] });
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
		block.childProject = { entries: [], path: 'Audio', blocks: [child] };
		projectGroupNavigation(store, events);
		dispatch('openProjectGroup', { codeBlock: block });
		store.set('codeBlockRendering.selectedCodeBlock', child);
		expect(state.projectChange.revision).toBe(0);
		applyCodeBlockSourceEdits(store, [{ codeBlock: child, code: ['module child', '; edited', 'moduleEnd'] }], {
			affectsCompilation: true,
		});
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
