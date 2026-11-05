import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/project-preparser';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, type Mock, vi } from 'vitest';
import { EMPTY_DEFAULT_PROJECT } from '~/features/project-loading/emptyDefaultProject';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import centerViewportOnCodeBlock from '../viewport/centerViewportOnCodeBlock';
import codeBlockRenderingEffect from './effect';
import { directiveDefinitions } from './features/directives/registry';
import projectGroupNavigation from './features/projectGroupNavigation/effect';
import { createLayoutRegistry } from './layout/registry';

describe('code block rendering cursor selection', () => {
	it.each(['view', 'edit'] as const)('updates shared source selection through the store in %s mode', editorMode => {
		const selectedBlock = createMockCodeBlock({
			code: ['; @tab 4', '\tvalue', 'two'],
			lineNumberColumnWidth: 1,
		});
		const state = createMockState({
			editorMode,
			featureFlags: {
				codeLineSelection: true,
			},
			codeBlockRendering: {
				currentProject: { entries: [], path: '', blocks: [selectedBlock] },
				selectedCodeBlock: selectedBlock,
			},
			viewport: {
				vGrid: 8,
				hGrid: 16,
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const onSelectedRowChanged = vi.fn();

		store.subscribe('codeBlockRendering.selectedCodeBlock.cursor.row', onSelectedRowChanged);
		codeBlockRenderingEffect(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);

		const codeBlockPointerDownHandler = (events.on as Mock).mock.calls.find(
			([eventName]) => eventName === 'codeBlockPointerDown'
		)?.[1] as ((event: { relativeX: number; relativeY: number; codeBlock: typeof selectedBlock }) => void) | undefined;

		codeBlockPointerDownHandler?.({
			relativeX: 8 * 8,
			relativeY: state.viewport.hGrid,
			codeBlock: selectedBlock,
		});

		expect(selectedBlock.cursor).toEqual({ row: 1, col: 2, y: 16 });
		expect(onSelectedRowChanged).toHaveBeenCalledWith(1);
	});
	it('keeps folded source selection and gap geometry available without an editing plugin', () => {
		const block = createMockCodeBlock({ code: ['note test', '; @hide', '; @tab 4', '\tvalue', 'noteEnd'] });
		const state = createMockState({
			editorMode: 'view',
			codeBlockRendering: { currentProject: { path: '', entries: [], blocks: [block] } },
		});
		const store = createStateManager(state);
		const emitter = new EventEmitter();
		const events = {
			on: emitter.on.bind(emitter),
			off: emitter.off.bind(emitter),
			dispatch: emitter.emit.bind(emitter),
		};
		const layout = createLayoutRegistry(codeBlock =>
			events.dispatch('codeBlockLayoutContributionsChanged', { codeBlock })
		);
		codeBlockRenderingEffect(store, events, directiveDefinitions, layout);
		expect(block.isCollapsed).toBe(true);
		const contribution = layout.createContribution();
		contribution.update(block, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 2, heightInRows: 2 }] });
		store.set('codeBlockRendering.selectedCodeBlock', block);
		expect(block.isCollapsed).toBe(false);
		Object.assign(state.viewport, { vGrid: 12, hGrid: 24 });
		events.dispatch('gridSizeChanged');
		events.dispatch('codeBlockPointerDown', { codeBlock: block, relativeX: 96, relativeY: 132 });
		expect(block.cursor).toEqual({ row: 3, col: 2, y: 120 });
		expect(state.editorMode).toBe('view');
		contribution.dispose();
		store.dispose();
	});
});

describe('code block rendering home directive', () => {
	it('renders root project-scope source as an editable code block', () => {
		const state = createMockState({
			initialProjectState: {
				...EMPTY_DEFAULT_PROJECT,
				code: ['pass env'],
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		store.set('initialProjectState', state.initialProjectState);

		expect(state.codeBlockRendering.currentProject.blocks).toHaveLength(1);
		expect(state.codeBlockRendering.currentProject.blocks[0]).toMatchObject({
			code: ['pass env'],
			isProjectScope: true,
			projectPath: '',
		});
	});

	it('renders project-level includes blocks from imported project state', () => {
		const includesBlock = ['includes', 'include std/events/risingEdge', 'includesEnd'];
		const state = createMockState({
			initialProjectState: {
				...EMPTY_DEFAULT_PROJECT,
				includes: [{ id: 0, code: includesBlock }],
				execution: [{ type: 'module', id: 1, code: ['module main', 'moduleEnd'], entry: 'main' }],
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		store.set('initialProjectState', state.initialProjectState);

		expect(state.codeBlockRendering.currentProject.blocks).toHaveLength(2);
		const renderedIncludes = state.codeBlockRendering.currentProject.blocks.find(
			block => block.blockType === 'includes'
		);
		expect(renderedIncludes?.code).toEqual(includesBlock);
	});

	it('renders root blocks and project-group blocks while retaining nested slices', () => {
		const state = createMockState({
			initialProjectState: {
				...EMPTY_DEFAULT_PROJECT,
				execution: [
					{ type: 'module', id: 0, entry: 'main', code: ['module root', 'moduleEnd'] },
					{
						entry: 'main',

						id: 0,
						type: 'group',
						...EMPTY_DEFAULT_PROJECT,
						name: 'Audio',

						code: ['group Audio', '; keep this comment', 'expose level &voice:level', 'groupEnd'],
						exposures: [
							{
								name: 'level',
								targetModuleName: 'voice',
								targetMemoryName: 'level',
							},
						],
						execution: [{ type: 'module', id: 1, entry: 'main', code: ['module voice', 'moduleEnd'] }],

						entries: ['main'],
					},
				],
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		store.set('initialProjectState', state.initialProjectState);

		expect(state.codeBlockRendering.currentProject.blocks).toBe(state.codeBlockRendering.rootProject.blocks);
		expect(state.codeBlockRendering.currentProject.blocks).toHaveLength(2);
		expect(state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual(['root', 'Audio']);
		const groupBlock = state.codeBlockRendering.currentProject.blocks[1];
		expect(groupBlock.projectPath).toBe('');
		expect(groupBlock.code).toEqual(['group Audio', '; keep this comment', 'expose level &voice:level', 'groupEnd']);
		expect(groupBlock.childProject?.blocks).toHaveLength(1);
		expect(groupBlock.childProject?.blocks?.[0]).toMatchObject({
			name: 'voice',
			entry: 'main',
			projectPath: 'Audio',
			code: ['module voice', 'moduleEnd'],
		});
		expect(state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'voice')).toBe(false);
	});

	it('retains imported entry membership in root and nested project views', () => {
		const project = parseProjectSource(`8f4e/v1
entry main
group audio
; @pos 10 20
entry main
group voices
; @pos 30 40
entry main
module voice
; @pos 50 60
float out
moduleEnd
entryEnd
groupEnd
entryEnd
groupEnd
entryEnd
entry test
group checks
; @pos -20 -10
entry main
entryEnd
groupEnd
entryEnd`);
		const state = createMockState({ initialProjectState: project });
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		codeBlockRenderingEffect(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		projectGroupNavigation(store, events);
		store.set('initialProjectState', project);

		const root = state.codeBlockRendering.rootProject.blocks;
		const audio = root.find(block => block.name === 'audio')!;
		expect(audio.entry).toBe('main');
		expect(state.codeBlockRendering.currentProject.entries).toEqual(['main', 'test']);
		expect(root.find(block => block.name === 'checks')!.entry).toBe('test');

		const openGroup = vi.mocked(events.on).mock.calls.find(([name]) => name === 'openProjectGroup')![1];
		const goBack = vi.mocked(events.on).mock.calls.find(([name]) => name === 'goToParentProjectGroup')![1];
		openGroup({ codeBlock: audio });
		const voices = state.codeBlockRendering.currentProject.blocks[0];
		expect(voices.name).toBe('voices');
		expect(state.codeBlockRendering.currentProject.entries).toEqual(['main']);
		expect(state.codeBlockRendering.currentProject.blocks[0].entry).toBe('main');

		openGroup({ codeBlock: voices });
		expect(state.codeBlockRendering.currentProject.blocks[0].name).toBe('voice');
		expect(state.codeBlockRendering.currentProject.entries).toEqual(['main']);
		expect(state.codeBlockRendering.currentProject.blocks[0].entry).toBe('main');

		goBack(undefined);
		goBack(undefined);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(root);
		expect(state.codeBlockRendering.currentProject.entries).toEqual(['main', 'test']);
		store.dispose();
	});

	it('resets the rendered slice pointer to the new root when a project reloads', () => {
		const state = createMockState({
			initialProjectState: {
				...EMPTY_DEFAULT_PROJECT,
				execution: [
					{
						entry: 'main',

						id: 0,
						type: 'group',
						...EMPTY_DEFAULT_PROJECT,
						name: 'Audio',

						code: ['group Audio', 'groupEnd'],
						exposures: [],
						execution: [{ type: 'module', id: 1, entry: 'main', code: ['module voice', 'moduleEnd'] }],

						entries: ['main'],
					},
				],
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		store.set('initialProjectState', state.initialProjectState);
		expect(state.compilerInputRevision).toBe(1);
		const firstRoot = state.codeBlockRendering.rootProject.blocks;
		const nestedSlice = firstRoot[0].childProject?.blocks;
		expect(nestedSlice).toBeDefined();
		store.set('codeBlockRendering.currentProject.blocks', nestedSlice!);

		store.set('initialProjectState', {
			...EMPTY_DEFAULT_PROJECT,
			execution: [{ type: 'module', id: 2, entry: 'main', code: ['module replacement', 'moduleEnd'] }],
		});

		expect(state.codeBlockRendering.rootProject.blocks).not.toBe(firstRoot);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(state.codeBlockRendering.rootProject.blocks);
		expect(state.compilerInputRevision).toBe(2);
		expect(state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual(['replacement']);
	});

	it('centers the initial viewport using the home alignment hint without selecting the block', () => {
		const state = createMockState({
			initialProjectState: {
				...EMPTY_DEFAULT_PROJECT,
				execution: [
					{ type: 'module', id: 0, code: ['module home', '; @home top', '; @pos 10 20', 'moduleEnd'], entry: 'main' },
				],
			},
			viewport: {
				x: 0,
				y: 0,
				width: 200,
				height: 200,
				roundedWidth: 200,
				roundedHeight: 200,
				vGrid: 8,
				hGrid: 16,
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		store.set('initialProjectState', state.initialProjectState);

		expect(state.codeBlockRendering.currentProject.blocks).toHaveLength(1);
		const [homeBlock] = state.codeBlockRendering.currentProject.blocks;
		expect(homeBlock.isHome).toBe(true);
		expect(homeBlock.homeAlignment).toBe('top');
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		expect(centerViewportOnCodeBlock(state.viewport, homeBlock, { alignment: 'top' })).toEqual({
			x: state.viewport.x,
			y: state.viewport.y,
		});
	});
});

describe('code block rendering @alwaysOnTop live edits', () => {
	it('re-partitions codeBlocks when @alwaysOnTop is added via live code edit', () => {
		const normalA = createMockCodeBlock({
			name: 'normalA',
			code: ['module normalA', 'moduleEnd'],
			alwaysOnTop: false,
		});
		const normalB = createMockCodeBlock({
			name: 'normalB',
			code: ['module normalB', 'moduleEnd'],
			alwaysOnTop: false,
		});
		const topA = createMockCodeBlock({
			name: 'topA',
			code: ['module topA', '; @alwaysOnTop', 'moduleEnd'],
			alwaysOnTop: true,
		});
		const codeBlocks = [normalA, normalB, topA];
		const state = createMockState({
			codeBlockRendering: {
				rootProject: { entries: [], path: '', blocks: codeBlocks },
				currentProject: { entries: [], path: '', blocks: codeBlocks },
				selectedCodeBlock: normalA,
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);

		store.set('codeBlockRendering.selectedCodeBlock.code', ['module normalA', '; @alwaysOnTop', 'moduleEnd']);

		expect(normalA.alwaysOnTop).toBe(true);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(codeBlocks);
		expect(state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual([
			'normalB',
			'normalA',
			'topA',
		]);
	});

	it('re-partitions codeBlocks when @alwaysOnTop is removed from the last of multiple top blocks via live code edit', () => {
		const normalA = createMockCodeBlock({
			name: 'normalA',
			code: ['module normalA', 'moduleEnd'],
			alwaysOnTop: false,
		});
		const normalB = createMockCodeBlock({
			name: 'normalB',
			code: ['module normalB', 'moduleEnd'],
			alwaysOnTop: false,
		});
		const topA = createMockCodeBlock({
			name: 'topA',
			code: ['module topA', '; @alwaysOnTop', 'moduleEnd'],
			alwaysOnTop: true,
		});
		const topB = createMockCodeBlock({
			name: 'topB',
			code: ['module topB', '; @alwaysOnTop', 'moduleEnd'],
			alwaysOnTop: true,
		});
		const codeBlocks = [normalA, normalB, topA, topB];
		const state = createMockState({
			codeBlockRendering: {
				rootProject: { entries: [], path: '', blocks: codeBlocks },
				currentProject: { entries: [], path: '', blocks: codeBlocks },
				selectedCodeBlock: topB,
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(
			store,
			events,
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);

		store.set('codeBlockRendering.selectedCodeBlock.code', ['module topB', 'moduleEnd']);

		expect(topB.alwaysOnTop).toBe(false);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(codeBlocks);
		expect(state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual([
			'normalA',
			'normalB',
			'topB',
			'topA',
		]);
	});
});
