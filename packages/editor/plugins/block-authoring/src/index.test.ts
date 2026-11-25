import { EventEmitter } from 'node:events';
import initState, { EMPTY_DEFAULT_PROJECT, insertCodeBlock, setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import { createEditorRenderRegistry } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { blockAuthoringPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

function setup(installed = true) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	const context = {
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		renderRegistry: createEditorRenderRegistry(),
	};
	const disposePlugin = installed ? blockAuthoringPlugin.setup(context) : () => {};
	events.dispatch('loadProject', { project: structuredClone(EMPTY_DEFAULT_PROJECT) });
	events.dispatch('enterEditMode');
	cleanups.push(store.dispose, disposePlugin);
	const state = store.getState();
	const openMenu = async (x = 700, y = 400) => {
		events.dispatch('contextmenu', { x, y });
		await Promise.resolve();
		return state.contextMenu.items;
	};
	return { store, state, events, disposePlugin, openMenu };
}

it.each([
	['module', 'New Module', 'module quark', 'moduleEnd'],
	['function', 'New Function', 'function quark', 'functionEnd'],
	['note', 'New Note', 'note', 'noteEnd'],
] as const)('inserts a %s template at the menu coordinates', async (blockType, title, header, end) => {
	const test = setup();
	vi.spyOn(Math, 'random').mockReturnValue(0);
	const revision = test.state.projectChange.revision;
	const compilerRevision = test.state.compilerInputRevision;
	await test.openMenu(96, 160);
	const index = test.state.contextMenu.items.findIndex(item => item.title === title);
	expect(index).toBeGreaterThanOrEqual(0);
	expect(test.state.contextMenu.items[index].payload).toEqual({ blockType });
	test.events.dispatch('activateContextMenuItem', { index, x: 96, y: 160 });
	const block = test.state.project.activeLevel.blocks.at(-1)!;
	expect(block.blockType).toBe(blockType);
	expect(block.projectPath).toBe('');
	expect(block.code).toEqual([header, '; @pos 12 10', '', '', end]);
	expect(block).toMatchObject({ gridX: 12, gridY: 10 });
	expect(test.state.contextMenu.open).toBe(false);
	expect(test.state.projectChange.revision).toBe(revision + 1);
	expect(test.state.compilerInputRevision).toBe(compilerRevision + 1);
});

it('allows duplicate generated names without numbering them', () => {
	const test = setup();
	vi.spyOn(Math, 'random').mockReturnValue(0);
	for (const x of [100, 200]) test.events.dispatch('createCodeBlock', { x, y: 200, blockType: 'module' });
	const blocks = test.state.project.activeLevel.blocks.filter(block => block.blockType === 'module');
	expect(blocks.map(block => block.name)).toEqual(['quark', 'quark']);
	expect(new Set(blocks.map(block => block.creationIndex)).size).toBe(2);
});

it.each([
	['module', ['module target', 'moduleEnd']],
	['function', ['function target', 'functionEnd']],
	['note', ['note target', 'noteEnd']],
	['group', ['group target', 'groupEnd']],
	['constants', ['constants target', 'constantsEnd']],
	['includes', ['includes', 'includesEnd']],
	['project source block', ['pass']],
	['unknown', ['int value 1']],
] as const)('labels deletion using the block kind: %s', async (label, source) => {
	const test = setup();
	const {
		insertedBlocks: [block],
	} = test.store.projectTransactions.apply({
		inserts: [
			{
				targetLevel: test.state.project.rootLevel,
				source: {
					code: [source[0], '; @pos 12 10', ...source.slice(1)],
					...(label === 'group' ? { childLevel: { entries: [], blocks: [] } } : {}),
				},
			},
		],
	});
	const items = await test.openMenu(block.x - test.state.viewport.x + 8, block.y - test.state.viewport.y + 8);
	expect(items).toContainEqual({
		title: `Delete ${label}`,
		action: 'deleteCodeBlock',
		payload: { codeBlock: block },
		close: true,
	});
});

it('deletes the clicked block instead of the selected block', async () => {
	const test = setup();
	test.events.dispatch('loadProject', {
		project: {
			...EMPTY_DEFAULT_PROJECT,
			notes: [
				{ id: 0, code: ['note target', '; @pos 12 10', 'noteEnd'] },
				{ id: 1, code: ['note other', '; @pos 40 10', 'noteEnd'] },
			],
		},
	});
	test.events.dispatch('enterEditMode');
	const blocks = () => test.state.project.activeLevel.blocks;
	const target = blocks().find(block => block.name === 'target')!;
	const other = blocks().find(block => block.name === 'other')!;
	test.store.set('project.selectedCodeBlock', other);
	const revision = test.state.projectChange.revision;
	const compilerRevision = test.state.compilerInputRevision;
	const items = await test.openMenu(104, 168);
	const index = items.findIndex(item => item.title === 'Delete note');
	expect(items[index].payload).toEqual({ codeBlock: target });
	test.events.dispatch('activateContextMenuItem', { index, x: 104, y: 168 });
	expect(blocks()).not.toContain(target);
	expect(test.state.project.selectedCodeBlock).toBe(other);
	expect(test.state.projectChange.revision).toBe(revision + 1);
	expect(test.state.compilerInputRevision).toBe(compilerRevision + 1);
});

it('hides authoring menu items and ignores commands in view mode', async () => {
	const test = setup();
	const block = test.state.project.activeLevel.blocks[0];
	test.events.dispatch('exitToViewMode');
	const revision = test.state.projectChange.revision;
	const count = test.state.project.activeLevel.blocks.length;
	const main = await test.openMenu();
	expect(main.some(item => item.action === 'createCodeBlock')).toBe(false);
	const menu = await test.openMenu(8, 8);
	expect(menu.some(item => item.action === 'deleteCodeBlock')).toBe(false);
	test.events.dispatch('createCodeBlock', { x: 200, y: 200, blockType: 'note' });
	test.events.dispatch('deleteCodeBlock', { codeBlock: block });
	expect(test.state.project.activeLevel.blocks).toHaveLength(count);
	expect(test.state.projectChange.revision).toBe(revision);
});

it('does not offer or perform deletion on read-only blocks', async () => {
	const test = setup();
	const environment = test.state.project.activeLevel.blocks.find(block => block.name === 'env')!;
	const before = test.state.projectChange.revision;
	const menu = await test.openMenu(8, 8);
	expect(menu.some(item => item.action === 'deleteCodeBlock')).toBe(false);
	test.events.dispatch('deleteCodeBlock', { codeBlock: environment });
	expect(test.state.project.activeLevel.blocks).toContain(environment);
	expect(test.state.projectChange.revision).toBe(before);
});

it.each([false, true])('owns its menu and action registrations: installed=%s', async installed => {
	const test = setup(installed);
	if (installed) test.disposePlugin();
	const block = test.state.project.activeLevel.blocks[0];
	const count = test.state.project.activeLevel.blocks.length;
	expect((await test.openMenu()).some(item => item.action === 'createCodeBlock')).toBe(false);
	expect((await test.openMenu(8, 8)).some(item => item.action === 'deleteCodeBlock')).toBe(false);
	test.events.dispatch('createCodeBlock', { x: 200, y: 200, blockType: 'note' });
	test.events.dispatch('deleteCodeBlock', { codeBlock: block });
	expect(test.state.project.activeLevel.blocks).toHaveLength(count);
	insertCodeBlock(test.store, { x: 200, y: 200, code: ['note supplied', 'noteEnd'] });
	expect(test.state.project.activeLevel.blocks.at(-1)!.name).toBe('supplied');
});

it('keeps installations independent', () => {
	const first = setup();
	const second = setup();
	first.disposePlugin();
	second.events.dispatch('createCodeBlock', { x: 200, y: 200, blockType: 'note' });
	expect(second.state.project.activeLevel.blocks.at(-1)!.blockType).toBe('note');
	expect(first.state.project.activeLevel.blocks).toHaveLength(1);
});
