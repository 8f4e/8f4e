import { parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { favoritesPlugin } from './index';

const cleanups: Array<() => void> = [];

function setup(code = ['module target', 'moduleEnd'], installed = true, mode: 'edit' | 'view' = 'edit') {
	const events = createEvents();

	const store = initState(events, {
		callbacks: {},
	});
	let pluginCleanup = installed
		? favoritesPlugin.setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				drawers: createEditorDrawerRegistry(),
			})
		: undefined;
	const disposePlugin = () => {
		pluginCleanup?.();
		pluginCleanup = undefined;
	};
	cleanups.push(() => {
		disposePlugin();
		store.dispose();
	});
	const inEntry = /^(module|group)\s/.test(code[0]);
	events.dispatch('loadProject', {
		project: parseProjectSource(
			`8f4e/v1\nconstants env\n; @pos 120 60\nconstantsEnd\n${inEntry ? 'entry main\n' : ''}${code.join('\n')}${inEntry ? '\nentryEnd' : ''}`
		),
	});
	events.dispatch(mode === 'edit' ? 'enterEditMode' : 'exitToViewMode');
	const state = store.getState();
	const block = state.codeBlockRendering.rootProject.blocks.find(candidate => candidate.code.includes(code[0]))!;

	const openMenu = async () => {
		events.dispatch('contextmenu', { x: block.x + 8, y: block.y + 8 });
		await Promise.resolve();
	};
	return { state, events, block, disposePlugin, openMenu };
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.useRealTimers();
});

describe('favorites plugin', () => {
	it.each([
		['module target', 'moduleEnd'],
		['function target', 'functionEnd'],
		['note target', 'noteEnd'],
		['constants target', 'constantsEnd'],
		['includes', 'includesEnd'],
		['group target', 'groupEnd'],
	])('inserts the favorite directive in %s', (...code) => {
		const test = setup(code);
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		expect(test.block.code.slice(0, 2)).toEqual([code[0], '; @favorite']);
	});

	it('removes every favorite directive while keeping other directives and source', () => {
		const test = setup(['module target', '; @favorite @pos 2 3', '; @favorite', 'int value 1', 'moduleEnd']);
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		expect(test.block.code).toEqual(['module target', '; @pos 2 3', 'int value 1', 'moduleEnd']);
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		expect(test.block.code).toContain('; @favorite');
	});

	it('publishes one project change without announcing changed compilation inputs', () => {
		const test = setup();
		const onInputChanged = vi.fn();
		test.events.on('compilationInputChanged', onInputChanged);
		const revision = test.state.compilerInputRevision;
		const projectRevision = test.state.projectChange.revision;
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		expect(test.state.compilerInputRevision).toBe(revision);
		expect(test.state.projectChange.revision).toBe(projectRevision + 1);
		expect(onInputChanged).not.toHaveBeenCalled();
	});

	it('keeps favorite snapshots independent of later in-place source edits', async () => {
		vi.useFakeTimers();
		const test = setup();
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		await vi.advanceTimersByTimeAsync(1000);
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		await vi.advanceTimersByTimeAsync(1000);
		expect(test.state.historyStack).toHaveLength(2);
		expect(test.state.historyStack[0].execution[0].code).not.toContain('; @favorite');
		expect(test.state.historyStack[1].execution[0].code).toContain('; @favorite');
		test.events.dispatch('undo');
		expect(test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'target')!.code).toContain(
			'; @favorite'
		);
		test.events.dispatch('undo');
		expect(
			test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'target')!.code
		).not.toContain('; @favorite');
	});

	it('uses the clicked block and updates the menu label after toggling', async () => {
		const test = setup();
		const other = test.state.codeBlockRendering.rootProject.blocks.find(block => block !== test.block)!;
		test.state.codeBlockRendering.selectedCodeBlock = other;
		const originalOtherCode = [...other.code];
		await test.openMenu();
		const index = test.state.contextMenu.items.findIndex(item => item.action === 'toggleFavoriteDirective');
		expect(index).toBeGreaterThanOrEqual(0);
		expect(test.state.contextMenu.items[index]).toMatchObject({
			title: expect.stringContaining('Favorite'),
			payload: { codeBlock: test.block },
		});
		test.state.contextMenu.highlightedItem = index;
		test.events.dispatch('mousedown', { x: test.block.x + 8, y: test.block.y + 8, stopPropagation: false });
		expect(test.state.contextMenu.open).toBe(false);
		expect(test.block.code).toContain('; @favorite');
		expect(other.code).toEqual(originalOtherCode);
		await test.openMenu();
		expect(test.state.contextMenu.items.find(item => item.action === 'toggleFavoriteDirective')?.title).toContain(
			'Unfavorite'
		);
		test.events.dispatch('openSubMenu', { menu: 'favoritesMenu' });
		await Promise.resolve();
		expect(test.state.contextMenu.items).toContainEqual(
			expect.objectContaining({
				action: 'jumpToFavoriteCodeBlock',
				payload: { creationIndex: test.block.creationIndex },
			})
		);
	});

	it('hides the action and does not edit in view mode', async () => {
		const test = setup(undefined, true, 'view');
		const code = [...test.block.code];
		await test.openMenu();
		expect(test.state.contextMenu.items.some(item => item.action === 'toggleFavoriteDirective')).toBe(false);
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		expect(test.block.code).toEqual(code);
	});

	it.each([false, true])('has no menu or handler when omitted or disposed: installed=%s', async installed => {
		const test = setup(['module target', '; @favorite', 'moduleEnd'], installed);
		const code = [...test.block.code];
		if (installed) test.disposePlugin();
		await test.openMenu();
		expect(test.state.contextMenu.items.some(item => item.action === 'toggleFavoriteDirective')).toBe(false);
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		expect(test.block.code).toEqual(code);
		test.events.dispatch('contextmenu', { x: 600, y: 400 });
		await Promise.resolve();
		expect(test.state.contextMenu.items.some(item => item.payload?.menu === 'favoritesMenu')).toBe(false);
		expect(test.state.envConstantContributions.favorites).toBeUndefined();
		expect(test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'env')!.code).not.toContain(
			'; @favorite'
		);
		test.events.dispatch('jumpToFavoriteCodeBlock', { creationIndex: test.block.creationIndex });
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
	});

	it('lists standalone and trailing favorites once per block in creation order', async () => {
		const test = setup([
			'module target',
			'; @favorite @alwaysOnTop @pos 50 20',
			'; @favorite',
			'moduleEnd',
			'module second',
			'int value 1 ; @favorite',
			'moduleEnd',
			'module other',
			'moduleEnd',
		]);
		test.events.dispatch('openSubMenu', { menu: 'favoritesMenu' });
		await Promise.resolve();
		const items = test.state.contextMenu.items.filter(item => item.action === 'jumpToFavoriteCodeBlock');
		expect(items).toMatchObject([
			{ title: expect.stringContaining('constants env') },
			{ title: expect.stringContaining('module target') },
			{ title: expect.stringContaining('module second') },
		]);
		expect(items.map(item => item.payload?.creationIndex)).toEqual(
			['env', 'target', 'second'].map(
				name => test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === name)!.creationIndex
			)
		);
	});

	it('offers navigation in view mode and jumps without changing project or compiler revisions', async () => {
		const test = setup(['module target', '; @favorite @pos 40 20', 'moduleEnd'], true, 'view');
		test.events.dispatch('contextmenu', { x: 600, y: 400 });
		await Promise.resolve();
		expect(test.state.contextMenu.items.some(item => item.payload?.menu === 'favoritesMenu')).toBe(true);
		test.events.dispatch('openSubMenu', { menu: 'favoritesMenu' });
		await Promise.resolve();
		const revision = test.state.projectChange.revision;
		const compilerRevision = test.state.compilerInputRevision;
		test.state.contextMenu.highlightedItem = test.state.contextMenu.items.findIndex(
			item => item.payload?.creationIndex === test.block.creationIndex
		);
		test.events.dispatch('mousedown', { x: 8, y: 8, stopPropagation: false });
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBe(test.block);
		expect(test.state.viewport.y).toBe(test.block.y + test.block.cursor.y - test.state.viewport.height / 2);
		expect(test.state.projectChange.revision).toBe(revision);
		expect(test.state.compilerInputRevision).toBe(compilerRevision);
	});

	it('uses the current project level and shows an empty placeholder after removing its last favorite', async () => {
		const test = setup([
			'group target',
			'entry main',
			'module nested',
			'; @favorite',
			'moduleEnd',
			'entryEnd',
			'groupEnd',
		]);
		const openFavorites = async () => {
			test.events.dispatch('openSubMenu', { menu: 'favoritesMenu' });
			await Promise.resolve();
		};
		await openFavorites();
		expect(test.state.contextMenu.items.some(item => item.title?.includes('nested'))).toBe(false);
		test.events.dispatch('openProjectGroup', { codeBlock: test.block });
		await openFavorites();
		const nested = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'nested')!;
		expect(test.state.contextMenu.items).toContainEqual(
			expect.objectContaining({ payload: { creationIndex: nested.creationIndex } })
		);
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: nested });
		await openFavorites();
		expect(test.state.contextMenu.items.filter(item => item.disabled)).toEqual([
			expect.objectContaining({ title: expect.stringContaining('No favorites'), disabled: true }),
		]);
	});

	it('isolates registrations and edits between editor instances', () => {
		const first = setup();
		const second = setup();
		first.events.dispatch('toggleFavoriteDirective', { codeBlock: first.block });
		expect(first.block.code).toContain('; @favorite');
		expect(second.block.code).not.toContain('; @favorite');
		first.disposePlugin();
		second.events.dispatch('toggleFavoriteDirective', { codeBlock: second.block });
		expect(second.block.code).toContain('; @favorite');
	});
});
