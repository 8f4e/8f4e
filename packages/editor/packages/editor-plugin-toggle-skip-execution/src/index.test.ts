import initState from '@8f4e/editor-state';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { EditorMenuRegistry, EventDispatcher } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toggleSkipExecutionPlugin } from './index';

function createEvents(): EventDispatcher {
	const handlers = new Map<string, Array<(event: unknown) => void>>();
	return {
		on: (name, handler) => {
			handlers.set(name, [...(handlers.get(name) ?? []), handler as (event: unknown) => void]);
		},
		off: (name, handler) => {
			handlers.set(
				name,
				(handlers.get(name) ?? []).filter(candidate => candidate !== handler)
			);
		},
		dispatch: (name, payload) => {
			for (const handler of handlers.get(name) ?? []) {
				if ((payload as { stopPropagation?: boolean } | undefined)?.stopPropagation) break;
				handler(payload);
			}
		},
	};
}

function createContext(code = ['module test', '', 'moduleEnd']) {
	const state = createMockState();
	const store = createStateManager(state);
	const events = createEvents();
	const unregisterMenuItem = vi.fn();
	const menus = { registerItem: vi.fn<EditorMenuRegistry['registerItem']>(() => unregisterMenuItem) };
	const codeBlock = createMockCodeBlock({ code, blockType: 'module', lastUpdated: 1000 });
	state.codeBlockRendering.codeBlocks.push(codeBlock);
	return { state, store, events, codeBlock, menus, unregisterMenuItem };
}

describe('toggle skip execution plugin', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('inserts the directive, publishes the source edit, and advances the compiler revision', () => {
		const context = createContext();
		const { state, store, events, codeBlock } = context;
		toggleSkipExecutionPlugin.setup(context);
		const revisions: string[][] = [];
		store.subscribe('compilerInputRevision', () => revisions.push([...codeBlock.code]));
		events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock });
		expect(codeBlock.code).toEqual(['module test', '#skipExecution', '', 'moduleEnd']);
		expect(codeBlock.lastUpdated).toBeGreaterThan(1000);
		expect(state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBe(codeBlock);
		expect(state.compilerInputRevision).toBe(1);
		expect(revisions).toEqual([codeBlock.code]);
		events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock });
		expect(codeBlock.code).toEqual(['module test', '', 'moduleEnd']);
		expect(state.compilerInputRevision).toBe(2);
	});

	it.each([['#skipExecution'], ['  #skipExecution'], ['#skipExecution  '], ['#skipExecution', '', '#skipExecution']])(
		'removes existing directives including whitespace and duplicates: %j',
		(...lines) => {
			const context = createContext(['module test', ...lines, 'moduleEnd']);
			toggleSkipExecutionPlugin.setup(context);
			context.events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: context.codeBlock });
			expect(context.codeBlock.code).toEqual(['module test', ...lines.filter(line => line === ''), 'moduleEnd']);
			expect(context.state.compilerInputRevision).toBe(1);
		}
	);

	it('does not edit source or advance the compiler revision in view mode', () => {
		const context = createContext();
		context.state.featureFlags.editing = false;
		toggleSkipExecutionPlugin.setup(context);
		context.events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: context.codeBlock });
		expect(context.codeBlock.code).toEqual(['module test', '', 'moduleEnd']);
		expect(context.codeBlock.lastUpdated).toBe(1000);
		expect(context.state.compilerInputRevision).toBe(0);
	});

	it('ignores malformed source without publishing an edit', () => {
		const context = createContext(['invalid']);
		toggleSkipExecutionPlugin.setup(context);
		context.events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: context.codeBlock });
		expect(context.codeBlock.lastUpdated).toBe(1000);
		expect(context.state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBeUndefined();
		expect(context.state.compilerInputRevision).toBe(0);
	});

	it('removes its handler on cleanup', () => {
		const context = createContext();
		const cleanup = toggleSkipExecutionPlugin.setup(context);
		cleanup?.();
		expect(context.unregisterMenuItem).toHaveBeenCalledOnce();
		context.events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: context.codeBlock });
		expect(context.codeBlock.code).toEqual(['module test', '', 'moduleEnd']);
	});

	it('owns the menu label, target, and visibility rules', () => {
		const context = createContext();
		toggleSkipExecutionPlugin.setup(context);
		const [menu, provider] = context.menus.registerItem.mock.calls[0];
		const { state, codeBlock } = context;
		expect(menu).toBe('moduleMenu');
		expect(provider({ state, codeBlock })).toEqual({
			title: 'Skip module',
			action: 'toggleModuleSkipExecutionDirective',
			payload: { codeBlock },
			close: true,
		});
		context.events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock });
		expect(provider({ state, codeBlock })?.title).toBe('Unskip module');
		expect(provider({ state })).toBeUndefined();
		expect(provider({ state, codeBlock: createMockCodeBlock({ blockType: 'note' }) })).toBeUndefined();
		state.featureFlags.editing = false;
		expect(provider({ state, codeBlock })).toBeUndefined();
	});

	it.each([true, false])('contributes the menu item only when installed: %s', async installed => {
		const events = createEvents();
		const store = initState(events, {
			callbacks: { loadSession: async () => null },
			runtimeRegistry: {},
			initialEditorMode: 'edit',
			plugins: installed ? [toggleSkipExecutionPlugin] : [],
		});
		try {
			const block = createMockCodeBlock({ code: ['module test', 'moduleEnd'], blockType: 'module', entry: 'main' });
			store.getState().codeBlockRendering.rootCodeBlocks.push(block);
			events.dispatch('contextmenu', { x: 16, y: 16 });
			await Promise.resolve();
			expect(
				store.getState().contextMenu.items.some(item => item.action === 'toggleModuleSkipExecutionDirective')
			).toBe(installed);
		} finally {
			store.dispose();
		}
	});

	it('opens the clicked block menu and toggles that block through the menu action', async () => {
		const events = createEvents();
		const store = initState(events, {
			callbacks: { loadSession: async () => null },
			runtimeRegistry: {},
			initialEditorMode: 'edit',
			plugins: [toggleSkipExecutionPlugin],
		});
		try {
			const block = createMockCodeBlock({ code: ['module target', 'moduleEnd'], blockType: 'module', entry: 'main' });
			const selected = createMockCodeBlock({
				code: ['module other', 'moduleEnd'],
				blockType: 'module',
				entry: 'main',
				x: 320,
				creationIndex: 1,
			});
			const state = store.getState();
			state.codeBlockRendering.rootCodeBlocks.push(block, selected);
			state.codeBlockRendering.selectedCodeBlock = selected;
			events.dispatch('contextmenu', { x: 16, y: 16 });
			await Promise.resolve();
			const index = state.contextMenu.items.findIndex(item => item.action === 'toggleModuleSkipExecutionDirective');
			expect(index).toBeGreaterThanOrEqual(0);
			expect(state.contextMenu.items[index].payload?.codeBlock).toBe(block);
			state.contextMenu.highlightedItem = index;
			events.dispatch('mousedown', { x: 16, y: 16 });
			expect(state.contextMenu.open).toBe(false);
			expect(block.code).toContain('#skipExecution');
			expect(selected.code).not.toContain('#skipExecution');
			events.dispatch('contextmenu', { x: 16, y: 16 });
			await Promise.resolve();
			expect(
				state.contextMenu.items.find(item => item.action === 'toggleModuleSkipExecutionDirective')?.title
			).toContain('Unskip module');
			store.set('featureFlags.editing', false);
			events.dispatch('contextmenu', { x: 16, y: 16 });
			await Promise.resolve();
			expect(state.contextMenu.items.some(item => item.action === 'toggleModuleSkipExecutionDirective')).toBe(false);
		} finally {
			store.dispose();
		}
	});

	it('works through editor initialization and schedules compilation of the updated source', async () => {
		vi.useFakeTimers();
		const events = createEvents();
		const compileCode = vi.fn().mockRejectedValue({ message: 'Test diagnostic', line: { lineNumber: 0 }, context: {} });
		const store = initState(events, {
			callbacks: { loadSession: async () => null, compileCode },
			runtimeRegistry: {},
			initialEditorMode: 'edit',
			plugins: [toggleSkipExecutionPlugin],
		});
		try {
			const block = createMockCodeBlock({ code: ['module test', 'moduleEnd'], blockType: 'module', entry: 'main' });
			store.getState().codeBlockRendering.rootCodeBlocks.push(block);
			events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: block });
			await vi.advanceTimersByTimeAsync(1000);
			expect(compileCode).toHaveBeenCalledOnce();
			expect(compileCode.mock.calls[0][0].modules[0].code).toContain('#skipExecution');
		} finally {
			store.dispose();
		}
	});

	it('keeps editor instances independent and stops handling actions after disposal', () => {
		const firstEvents = createEvents();
		const secondEvents = createEvents();
		const options = {
			callbacks: { loadSession: async () => null },
			runtimeRegistry: {},
			initialEditorMode: 'edit' as const,
			plugins: [toggleSkipExecutionPlugin],
		};
		const first = initState(firstEvents, options);
		const second = initState(secondEvents, options);
		const block = createMockCodeBlock({ code: ['module test', 'moduleEnd'], blockType: 'module', entry: 'main' });
		firstEvents.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: block });
		expect(first.getState().compilerInputRevision).toBe(1);
		expect(second.getState().compilerInputRevision).toBe(0);
		first.dispose();
		firstEvents.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: block });
		expect(block.code).toContain('#skipExecution');
		secondEvents.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: block });
		expect(block.code).not.toContain('#skipExecution');
		expect(second.getState().compilerInputRevision).toBe(1);
		second.dispose();
	});
});
