import { parseProjectSource } from '@8f4e/compiler';
import initState, { setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import { createEditorRenderRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { favoritesPlugin } from './index';

const cleanups: Array<() => void> = [];

function setup(code = ['module target', 'moduleEnd'], installed = true, mode: 'edit' | 'view' = 'edit') {
	const events = createEvents();

	const store = initState(events, {
		callbacks: {},
	});
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
	let pluginCleanup = installed ? favoritesPlugin.setup(context) : undefined;
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
	const block = state.project.rootLevel.blocks.find(candidate => candidate.code.includes(code[0]))!;

	const openMenu = async () => {
		events.dispatch('contextmenu', { x: block.x + 8, y: block.y + 8 });
		await Promise.resolve();
	};
	return { state, store, events, block, disposePlugin, openMenu };
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

	it('publishes one project and compilation-input change when favoriting a block', () => {
		const test = setup();
		const onInputChanged = vi.fn();
		test.store.subscribe('compilerInputRevision', onInputChanged);
		const revision = test.state.compilerInputRevision;
		const projectRevision = test.state.projectChange.revision;
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		expect(test.state.compilerInputRevision).toBe(revision + 1);
		expect(test.state.projectChange.revision).toBe(projectRevision + 1);
		expect(onInputChanged).toHaveBeenCalledTimes(1);
	});

	it('announces compilation inputs when unfavoriting an inline directive without changing the line count', () => {
		const test = setup(['module target', 'int value 1 ; @favorite', 'moduleEnd']);
		const revision = test.state.compilerInputRevision;
		const onInputChanged = vi.fn();
		test.store.subscribe('compilerInputRevision', onInputChanged);
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		expect(test.block.code).toEqual(['module target', 'int value 1', 'moduleEnd']);
		expect(test.state.compilerInputRevision).toBe(revision + 1);
		expect(onInputChanged).toHaveBeenCalledTimes(1);
	});

	it('replaces source when toggling a favorite without mutating the previous source', () => {
		const test = setup();
		const initial = test.block.code;
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		const favorited = test.block.code;
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		expect(initial).not.toContain('; @favorite');
		expect(favorited).toContain('; @favorite');
		expect(test.block.code).toEqual(initial);
	});

	it('uses the clicked block and updates the menu label after toggling', async () => {
		const test = setup();
		const other = test.state.project.rootLevel.blocks.find(block => block !== test.block)!;
		test.state.project.selectedCodeBlock = other;
		const originalOtherCode = [...other.code];
		await test.openMenu();
		const index = test.state.contextMenu.items.findIndex(item => item.action === 'toggleFavoriteDirective');
		expect(index).toBeGreaterThanOrEqual(0);
		expect(test.state.contextMenu.items[index]).toMatchObject({
			title: expect.stringContaining('Favorite'),
			payload: { codeBlock: test.block },
		});
		test.events.dispatch('activateContextMenuItem', {
			x: test.block.x + 8,
			y: test.block.y + 8,
			index,
		});
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

	it('preserves a read-only source favorite without offering to edit it', async () => {
		const test = setup(['module target', '; @pos 40 20', 'moduleEnd']);
		const environment = test.state.project.rootLevel.blocks.find(block => block.name === 'env')!;
		const revision = test.state.projectChange.revision;
		test.events.dispatch('contextmenu', { x: 8, y: 8 });
		await Promise.resolve();
		expect(test.state.contextMenu.items.some(item => item.action === 'toggleFavoriteDirective')).toBe(false);
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: environment });
		expect(environment.code).toContain('; @favorite');
		expect(test.state.projectChange.revision).toBe(revision);
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
		expect(test.state.project.activeLevel.blocks.find(block => block.name === 'env')!.code).not.toContain(
			'; @favorite'
		);
		test.events.dispatch('jumpToFavoriteCodeBlock', { creationIndex: test.block.creationIndex });
		expect(test.state.project.selectedCodeBlock).toBeUndefined();
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
			{ title: expect.stringContaining('module target') },
			{ title: expect.stringContaining('module second') },
			{ title: expect.stringContaining('constants env') },
		]);
		expect(items.map(item => item.payload?.creationIndex)).toEqual(
			['target', 'second', 'env'].map(
				name => test.state.project.activeLevel.blocks.find(block => block.name === name)!.creationIndex
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
		const menuItemIndex = test.state.contextMenu.items.findIndex(
			item => item.payload?.creationIndex === test.block.creationIndex
		);
		const viewportChanged = vi.fn();
		test.events.on('viewportChanged', viewportChanged);
		test.events.dispatch('activateContextMenuItem', {
			x: 8,
			y: 8,
			index: menuItemIndex,
		});
		expect(test.state.project.selectedCodeBlock).toBe(test.block);
		expect(viewportChanged).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ x: test.state.viewport.x, y: test.state.viewport.y, source: 'navigation' })
		);
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
		const nested = test.state.project.activeLevel.blocks.find(block => block.name === 'nested')!;
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
