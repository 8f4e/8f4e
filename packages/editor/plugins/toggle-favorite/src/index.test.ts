import { parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { toggleFavoritePlugin } from './index';

const cleanups: Array<() => void> = [];

function setup(code = ['module target', 'moduleEnd'], installed = true, mode: 'edit' | 'view' = 'edit') {
	const events = createEvents();

	const store = initState(events, {
		callbacks: {},
		runtimeRegistry: {},
		initialEditorMode: mode,
	});
	const disposePlugin = installed
		? toggleFavoritePlugin.setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				drawers: createCodeBlockDrawerRegistry(),
			})
		: () => {};
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
	const state = store.getState();
	const block = state.codeBlockRendering.rootCodeBlocks.find(candidate => candidate.code.includes(code[0]))!;

	const openMenu = async () => {
		events.dispatch('contextmenu', { x: block.x + 8, y: block.y + 8 });
		await Promise.resolve();
	};
	return { store, state, events, block, disposePlugin, openMenu };
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.useRealTimers();
});

describe('toggle favorite plugin', () => {
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
		expect(test.block.isFavorite).toBe(true);
		expect(test.state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBe(test.block);
	});

	it('removes every favorite directive while keeping other directives and source', () => {
		const test = setup(['module target', '; @favorite @pos 2 3', '; @favorite', 'int value 1', 'moduleEnd']);
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		expect(test.block.code).toEqual(['module target', '; @pos 2 3', 'int value 1', 'moduleEnd']);
		expect(test.block.isFavorite).toBe(false);
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		expect(test.block.isFavorite).toBe(true);
	});

	it('updates the timestamp without scheduling compilation for metadata changes', async () => {
		vi.useFakeTimers();
		const test = setup();
		await vi.advanceTimersByTimeAsync(1000);
		const compileCode = vi.fn();
		test.state.callbacks.compileCode = compileCode;
		const revision = test.state.compilerInputRevision;
		const lastUpdated = test.block.lastUpdated;
		await vi.advanceTimersByTimeAsync(10);
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		expect(test.block.lastUpdated).toBeGreaterThan(lastUpdated);
		expect(test.state.compilerInputRevision).toBe(revision);
		await vi.advanceTimersByTimeAsync(1000);
		expect(compileCode).not.toHaveBeenCalled();
	});

	it('uses the clicked block and updates the menu label after toggling', async () => {
		const test = setup();
		const other = test.state.codeBlockRendering.rootCodeBlocks.find(block => block !== test.block)!;
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
		expect(test.block.isFavorite).toBe(true);
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
		const test = setup(undefined, installed);
		if (installed) test.disposePlugin();
		await test.openMenu();
		expect(test.state.contextMenu.items.some(item => item.action === 'toggleFavoriteDirective')).toBe(false);
		test.events.dispatch('toggleFavoriteDirective', { codeBlock: test.block });
		expect(test.block.isFavorite).toBe(false);
	});

	it('isolates registrations and edits between editor instances', () => {
		const first = setup();
		const second = setup();
		first.events.dispatch('toggleFavoriteDirective', { codeBlock: first.block });
		expect(first.block.isFavorite).toBe(true);
		expect(second.block.isFavorite).toBe(false);
		first.disposePlugin();
		second.events.dispatch('toggleFavoriteDirective', { codeBlock: second.block });
		expect(second.block.isFavorite).toBe(true);
	});
});
