import { parseProjectSource } from '@8f4e/project-preparser';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, type Mock, vi } from 'vitest';
import { EMPTY_DEFAULT_PROJECT } from '~/features/project-import/emptyDefaultProject';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import centerViewportOnCodeBlock from '../viewport/centerViewportOnCodeBlock';
import codeBlockRenderingEffect from './effect';
import { directiveDefinitions } from './features/directives/registry';
import entryOutlines from './features/entryOutlines/effect';
import parsedDirectivesUpdater from './features/parsedDirectivesUpdater/effect';
import projectGroupNavigation from './features/projectGroupNavigation/effect';

function createFontIds() {
	return new Proxy(
		{ 63: 63 },
		{
			get: (target, key) => {
				const characterCode = Number(key);
				return Number.isNaN(characterCode) ? Reflect.get(target, key) : characterCode;
			},
		}
	);
}

function createSpriteLookups() {
	return {
		fillColors: {},
		fontSecondaryBase: createFontIds(),
		fontInkBase: createFontIds(),
		fontInkFaint: createFontIds(),
		fontMutedBase: createFontIds(),
	} as never;
}

describe('code block layout readiness', () => {
	it('runs widget callbacks with current block dimensions, row gaps, and cursor coordinates', () => {
		const block = createMockCodeBlock({
			code: ['module layoutProbe', '; @layoutProbe', 'push 1', 'moduleEnd'],
			width: 1,
			height: 1,
			cursor: { row: 2, col: 0, x: -1, y: -1 },
		});
		const state = createMockState({ codeBlockRendering: { codeBlocks: [block] } });
		const store = createStateManager(state);
		const layouts: Array<{ width: number; height: number; cursorX: number; cursorY: number; gap: number }> = [];
		codeBlockRenderingEffect(store, createMockEventDispatcherWithVitest(), [
			...directiveDefinitions,
			{
				name: 'layoutProbe',
				apply: (directive, draft) => {
					draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 2 });
					draft.layoutCallbacks.push({
						beforeGraphicDataWidthCalculation: codeBlock => {
							codeBlock.minGridWidth = 40;
						},
						onBlockLayoutReady: codeBlock => {
							layouts.push({
								width: codeBlock.width,
								height: codeBlock.height,
								cursorX: codeBlock.cursor.x,
								cursorY: codeBlock.cursor.y,
								gap: codeBlock.gaps.get(1)!.size,
							});
						},
					});
				},
			},
		]);
		expect(layouts).toEqual([{ width: 320, height: 96, cursorX: 24, cursorY: 64, gap: 2 }]);
		state.viewport.vGrid = 10;
		state.viewport.hGrid = 20;
		store.set('info', state.info);
		expect(layouts.at(-1)).toEqual({ width: 400, height: 120, cursorX: 30, cursorY: 80, gap: 2 });
		store.dispose();
	});
});

describe('code block rendering error mapping', () => {
	it('maps project-scope compiler errors by canonical group path', () => {
		const rootScope = createMockCodeBlock({
			code: ['pass env'],
			isProjectScope: true,
			projectPath: '',
			creationIndex: 7,
		});
		const group = createMockCodeBlock({
			name: 'audio',
			code: ['group audio', 'pass env', 'groupEnd'],
			projectPath: '',
			nestedProjectCodeBlocks: [],
			creationIndex: 8,
		});
		const state = createMockState({
			codeBlockRendering: { codeBlocks: [rootScope, group] },
			codeErrors: {
				compilationErrors: [
					{ lineNumber: 0, codeBlockId: -1, projectGroupPath: '', message: 'Undefined root constant' },
					{ lineNumber: 1, codeBlockId: -1, projectGroupPath: 'audio', message: 'Undefined child constant' },
				],
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(store, events, directiveDefinitions);

		expect(rootScope.widgets.errorMessages[0]?.message.join('')).toContain('Undefined root constant');
		expect(group.widgets.errorMessages[0]?.message.join('')).toContain('Undefined child constant');
	});

	it('maps compiler errors by creationIndex', () => {
		const functionBlock = createMockCodeBlock({
			name: 'helper',
			creationIndex: 7,
			code: ['function helper', 'push 1', 'functionEnd'],
			blockType: 'function',
		});
		const state = createMockState({
			codeBlockRendering: {
				codeBlocks: [functionBlock],
			},
			codeErrors: {
				compilationErrors: [
					{
						lineNumber: 2,
						codeBlockId: 7,
						message: 'Memory access is not allowed in pure functions. (19)',
					},
				],
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(store, events, directiveDefinitions);

		expect(functionBlock.widgets.errorMessages).toHaveLength(1);
		expect(functionBlock.widgets.errorMessages[0].lineNumber).toBe(2);
		expect(functionBlock.widgets.errorMessages[0].message).toContain(' Error:');
	});
});

describe('code block rendering cursor selection', () => {
	it('updates the selected code block cursor through the store when a line is clicked', () => {
		const selectedBlock = createMockCodeBlock({
			code: ['zero', 'one', 'two'],
			lineNumberColumnWidth: 1,
		});
		const state = createMockState({
			featureFlags: {
				codeLineSelection: true,
			},
			codeBlockRendering: {
				codeBlocks: [selectedBlock],
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
		codeBlockRenderingEffect(store, events, directiveDefinitions);

		const codeBlockPointerDownHandler = (events.on as Mock).mock.calls.find(
			([eventName]) => eventName === 'codeBlockPointerDown'
		)?.[1] as ((event: { relativeX: number; relativeY: number; codeBlock: typeof selectedBlock }) => void) | undefined;

		codeBlockPointerDownHandler?.({
			relativeX: 0,
			relativeY: state.viewport.hGrid,
			codeBlock: selectedBlock,
		});

		expect(selectedBlock.cursor.row).toBe(1);
		expect(onSelectedRowChanged).toHaveBeenCalledWith(1);
	});
});

describe('code block rendering home directive', () => {
	it('renders root project-scope source as an editable code block', () => {
		const state = createMockState({
			initialProjectState: {
				...EMPTY_DEFAULT_PROJECT,
				code: ['pass env'],
			},
			spriteLookups: createSpriteLookups(),
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(store, events, directiveDefinitions);
		store.set('initialProjectState', state.initialProjectState);

		expect(state.codeBlockRendering.codeBlocks).toHaveLength(1);
		expect(state.codeBlockRendering.codeBlocks[0]).toMatchObject({
			code: ['pass env'],
			isProjectScope: true,
			projectPath: '',
		});
	});

	it('clears output addresses when the rendered project slice changes', () => {
		const state = createMockState();
		state.codeBlockRendering.outputsByWordAddress.set(40, {} as never);
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		codeBlockRenderingEffect(store, events, directiveDefinitions);

		store.set('codeBlockRendering.codeBlocks', []);

		expect(state.codeBlockRendering.outputsByWordAddress.size).toBe(0);
	});

	it('renders project-level includes blocks from imported project state', () => {
		const includesBlock = ['includes', 'include std/events/risingEdge', 'includesEnd'];
		const state = createMockState({
			initialProjectState: {
				...EMPTY_DEFAULT_PROJECT,
				includes: [{ id: 0, code: includesBlock }],
				modules: [
					{
						id: 1,
						code: ['module main', 'moduleEnd'],
						entry: 'main',
					},
				],
			},
			spriteLookups: createSpriteLookups(),
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(store, events, directiveDefinitions);
		store.set('initialProjectState', state.initialProjectState);

		expect(state.codeBlockRendering.codeBlocks).toHaveLength(2);
		const renderedIncludes = state.codeBlockRendering.codeBlocks.find(block => block.blockType === 'includes');
		expect(renderedIncludes?.code).toEqual(includesBlock);
	});

	it('renders root blocks and project-group blocks while retaining nested slices', () => {
		const state = createMockState({
			initialProjectState: {
				...EMPTY_DEFAULT_PROJECT,
				modules: [{ id: 0, entry: 'main', code: ['module root', 'moduleEnd'] }],
				groups: [
					{
						...EMPTY_DEFAULT_PROJECT,
						name: 'Audio',
						entry: 'main',
						code: ['group Audio', '; keep this comment', 'expose level &voice:level', 'groupEnd'],
						exposures: [
							{
								name: 'level',
								targetModuleName: 'voice',
								targetMemoryName: 'level',
							},
						],
						modules: [{ id: 1, entry: 'main', code: ['module voice', 'moduleEnd'] }],
					},
				],
			},
			spriteLookups: createSpriteLookups(),
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(store, events, directiveDefinitions);
		store.set('initialProjectState', state.initialProjectState);

		expect(state.codeBlockRendering.codeBlocks).toBe(state.codeBlockRendering.rootCodeBlocks);
		expect(state.codeBlockRendering.codeBlocks).toHaveLength(2);
		expect(state.codeBlockRendering.codeBlocks.map(block => block.name)).toEqual(['root', 'Audio']);
		const groupBlock = state.codeBlockRendering.codeBlocks[1];
		expect(groupBlock.projectPath).toBe('');
		expect(groupBlock.code).toEqual([
			'group Audio',
			'; keep this comment',
			'expose level &voice:level',
			'; @pos 0 -6',
			'groupEnd',
		]);
		expect(groupBlock.nestedProjectCodeBlocks).toHaveLength(1);
		expect(groupBlock.nestedProjectCodeBlocks?.[0]).toMatchObject({
			name: 'voice',
			entry: 'main',
			projectPath: 'Audio',
			code: ['module voice', 'moduleEnd'],
		});
		expect(state.codeBlockRendering.codeBlocks.some(block => block.name === 'voice')).toBe(false);
	});

	it('outlines imported group entries in the root and nested project views', () => {
		const project = parseProjectSource(`8f4e/v1
entry main
group audio
; @pos 10 20
group voices
; @pos 30 40
module voice
; @pos 50 60
float out
moduleEnd
groupEnd
groupEnd
entryEnd
entry test
group checks
; @pos -20 -10
groupEnd
entryEnd`);
		const state = createMockState({ initialProjectState: project, spriteLookups: createSpriteLookups() });
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		codeBlockRenderingEffect(store, events, directiveDefinitions);
		entryOutlines(store);
		projectGroupNavigation(store, events);
		store.set('initialProjectState', project);

		const root = state.codeBlockRendering.rootCodeBlocks;
		const audio = root.find(block => block.name === 'audio')!;
		expect(audio.entry).toBe('main');
		expect(state.codeBlockRendering.entryOutlines.map(outline => outline.entryName)).toEqual(['main', 'test']);
		expect(state.codeBlockRendering.entryOutlines[0]).toMatchObject({ topLeft: { x: 16, y: 256 } });

		const openGroup = vi.mocked(events.on).mock.calls.find(([name]) => name === 'openProjectGroup')![1];
		const goBack = vi.mocked(events.on).mock.calls.find(([name]) => name === 'goToParentProjectGroup')![1];
		openGroup({ codeBlock: audio });
		const voices = state.codeBlockRendering.codeBlocks[0];
		expect(voices.name).toBe('voices');
		expect(state.codeBlockRendering.entryOutlines).toHaveLength(1);
		expect(state.codeBlockRendering.entryOutlines[0]).toMatchObject({
			entryName: 'main',
			topLeft: { x: 176, y: 576 },
		});

		openGroup({ codeBlock: voices });
		expect(state.codeBlockRendering.codeBlocks[0].name).toBe('voice');
		expect(state.codeBlockRendering.entryOutlines).toHaveLength(1);
		expect(state.codeBlockRendering.entryOutlines[0]).toMatchObject({
			entryName: 'main',
			topLeft: { x: 336, y: 896 },
		});

		goBack(undefined);
		goBack(undefined);
		expect(state.codeBlockRendering.codeBlocks).toBe(root);
		expect(state.codeBlockRendering.entryOutlines.map(outline => outline.entryName)).toEqual(['main', 'test']);
		store.dispose();
	});

	it('resets the rendered slice pointer to the new root when a project reloads', () => {
		const state = createMockState({
			initialProjectState: {
				...EMPTY_DEFAULT_PROJECT,
				groups: [
					{
						...EMPTY_DEFAULT_PROJECT,
						name: 'Audio',
						entry: 'main',
						code: ['group Audio', 'groupEnd'],
						exposures: [],
						modules: [{ id: 1, entry: 'main', code: ['module voice', 'moduleEnd'] }],
					},
				],
			},
			spriteLookups: createSpriteLookups(),
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(store, events, directiveDefinitions);
		store.set('initialProjectState', state.initialProjectState);
		expect(state.compilerInputRevision).toBe(1);
		const firstRoot = state.codeBlockRendering.rootCodeBlocks;
		const nestedSlice = firstRoot[0].nestedProjectCodeBlocks;
		expect(nestedSlice).toBeDefined();
		store.set('codeBlockRendering.codeBlocks', nestedSlice!);

		store.set('initialProjectState', {
			...EMPTY_DEFAULT_PROJECT,
			modules: [{ id: 2, entry: 'main', code: ['module replacement', 'moduleEnd'] }],
		});

		expect(state.codeBlockRendering.rootCodeBlocks).not.toBe(firstRoot);
		expect(state.codeBlockRendering.codeBlocks).toBe(state.codeBlockRendering.rootCodeBlocks);
		expect(state.compilerInputRevision).toBe(2);
		expect(state.codeBlockRendering.codeBlocks.map(block => block.name)).toEqual(['replacement']);
	});

	it('centers the initial viewport using the home alignment hint without selecting the block', () => {
		const state = createMockState({
			initialProjectState: {
				...EMPTY_DEFAULT_PROJECT,
				modules: [
					{
						id: 0,
						code: ['module home', '; @home top', '; @pos 10 20', 'moduleEnd'],
						entry: 'main',
					},
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
			spriteLookups: createSpriteLookups(),
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(store, events, directiveDefinitions);
		store.set('initialProjectState', state.initialProjectState);

		expect(state.codeBlockRendering.codeBlocks).toHaveLength(1);
		const [homeBlock] = state.codeBlockRendering.codeBlocks;
		expect(homeBlock.isHome).toBe(true);
		expect(homeBlock.homeAlignment).toBe('top');
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		expect(centerViewportOnCodeBlock(state.viewport, homeBlock, { alignment: 'top' })).toEqual({
			x: state.viewport.x,
			y: state.viewport.y,
		});
	});

	it('keeps the unselected home block centered after a font grid change', () => {
		const state = createMockState({
			initialProjectState: {
				...EMPTY_DEFAULT_PROJECT,
				modules: [
					{
						id: 0,
						code: ['module home', '; @home', '; @pos 10 20', 'moduleEnd'],
						entry: 'main',
					},
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
			spriteLookups: createSpriteLookups(),
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		codeBlockRenderingEffect(store, events, directiveDefinitions);
		store.set('initialProjectState', state.initialProjectState);

		const [homeBlock] = state.codeBlockRendering.codeBlocks;
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();

		state.viewport.vGrid = 6;
		state.viewport.hGrid = 12;
		const spriteSheetRerenderedHandler = (events.on as Mock).mock.calls.find(
			([eventName]) => eventName === 'spriteSheetRerendered'
		)?.[1] as (() => void) | undefined;
		spriteSheetRerenderedHandler?.();

		expect({ x: homeBlock.x, y: homeBlock.y }).toEqual({
			x: homeBlock.gridX * state.viewport.vGrid,
			y: homeBlock.gridY * state.viewport.hGrid,
		});
		expect(centerViewportOnCodeBlock(state.viewport, homeBlock)).toEqual({
			x: state.viewport.x,
			y: state.viewport.y,
		});
	});

	it('keeps the selected code block centered after a font grid change', () => {
		const selectedBlock = createMockCodeBlock({
			name: 'selected',
			code: ['module selected', '; @pos 10 20', 'moduleEnd'],
			gridX: 10,
			gridY: 20,
			x: 80,
			y: 320,
		});
		const state = createMockState({
			codeBlockRendering: {
				codeBlocks: [selectedBlock],
				selectedCodeBlock: selectedBlock,
			},
			spriteLookups: createSpriteLookups(),
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

		codeBlockRenderingEffect(store, events, directiveDefinitions);
		state.viewport.vGrid = 6;
		state.viewport.hGrid = 12;
		const spriteSheetRerenderedHandler = (events.on as Mock).mock.calls.find(
			([eventName]) => eventName === 'spriteSheetRerendered'
		)?.[1] as (() => void) | undefined;
		spriteSheetRerenderedHandler?.();

		expect({ x: selectedBlock.x, y: selectedBlock.y }).toEqual({
			x: selectedBlock.gridX * state.viewport.vGrid,
			y: selectedBlock.gridY * state.viewport.hGrid,
		});
		expect(centerViewportOnCodeBlock(state.viewport, selectedBlock)).toEqual({
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
				rootCodeBlocks: codeBlocks,
				codeBlocks,
				selectedCodeBlock: normalA,
			},
			spriteLookups: createSpriteLookups(),
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		parsedDirectivesUpdater(store);
		codeBlockRenderingEffect(store, events, directiveDefinitions);

		store.set('codeBlockRendering.selectedCodeBlock.code', ['module normalA', '; @alwaysOnTop', 'moduleEnd']);

		expect(normalA.alwaysOnTop).toBe(true);
		expect(state.codeBlockRendering.codeBlocks).toBe(codeBlocks);
		expect(state.codeBlockRendering.codeBlocks.map(block => block.name)).toEqual(['normalB', 'normalA', 'topA']);
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
				rootCodeBlocks: codeBlocks,
				codeBlocks,
				selectedCodeBlock: topB,
			},
			spriteLookups: createSpriteLookups(),
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		parsedDirectivesUpdater(store);
		codeBlockRenderingEffect(store, events, directiveDefinitions);

		store.set('codeBlockRendering.selectedCodeBlock.code', ['module topB', 'moduleEnd']);

		expect(topB.alwaysOnTop).toBe(false);
		expect(state.codeBlockRendering.codeBlocks).toBe(codeBlocks);
		expect(state.codeBlockRendering.codeBlocks.map(block => block.name)).toEqual([
			'normalA',
			'normalB',
			'topB',
			'topA',
		]);
	});
});
