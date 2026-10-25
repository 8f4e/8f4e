import initState from '@8f4e/editor-state';
import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import type { EventDispatcher, Options } from '@8f4e/editor-state-types';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
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

const cleanups: Array<() => void> = [];

function setupState(events: EventDispatcher, options: Options, installed = true) {
	const store = initState(events, options);
	const disposePlugin = installed
		? toggleSkipExecutionPlugin.setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				drawers: createCodeBlockDrawerRegistry(),
			})
		: () => {};
	const dispose = () => {
		disposePlugin();
		store.dispose();
	};
	cleanups.push(dispose);
	return { store, dispose };
}

function createContext(code = ['module test', '', 'moduleEnd']) {
	const events = createEvents();
	const { store, dispose } = setupState(events, {
		callbacks: { loadSession: async () => null },
		runtimeRegistry: {},
		initialEditorMode: 'edit',
	});
	const state = store.getState();
	const codeBlock = createMockCodeBlock({ code, blockType: 'module', entry: 'main', lastUpdated: 1000 });
	state.codeBlockRendering.rootCodeBlocks.push(codeBlock);
	return { state, store, events, codeBlock, dispose };
}

describe('toggle skip execution plugin', () => {
	afterEach(() => {
		while (cleanups.length) cleanups.pop()!();
		vi.useRealTimers();
	});

	it('inserts the directive, publishes the source edit, and advances the compiler revision', () => {
		const context = createContext();
		const { state, store, events, codeBlock } = context;
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
			context.events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: context.codeBlock });
			expect(context.codeBlock.code).toEqual(['module test', ...lines.filter(line => line === ''), 'moduleEnd']);
			expect(context.state.compilerInputRevision).toBe(1);
		}
	);

	it('does not edit source or advance the compiler revision in view mode', () => {
		const context = createContext();
		context.state.featureFlags.editing = false;
		context.events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: context.codeBlock });
		expect(context.codeBlock.code).toEqual(['module test', '', 'moduleEnd']);
		expect(context.codeBlock.lastUpdated).toBe(1000);
		expect(context.state.compilerInputRevision).toBe(0);
	});

	it('ignores malformed source without publishing an edit', () => {
		const context = createContext(['invalid']);
		context.events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: context.codeBlock });
		expect(context.codeBlock.lastUpdated).toBe(1000);
		expect(context.state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBeUndefined();
		expect(context.state.compilerInputRevision).toBe(0);
	});

	it('removes its handler when the host is disposed', () => {
		const context = createContext();
		context.dispose();
		context.events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: context.codeBlock });
		expect(context.codeBlock.code).toEqual(['module test', '', 'moduleEnd']);
	});

	it.each([
		{ installed: true, blockType: 'module' as const, visible: true },
		{ installed: false, blockType: 'module' as const, visible: false },
		{ installed: true, blockType: 'note' as const, visible: false },
	])(
		'contributes the menu item for installed module actions: $installed, $blockType',
		async ({ installed, blockType, visible }) => {
			const events = createEvents();
			const { store, dispose } = setupState(
				events,
				{
					callbacks: { loadSession: async () => null },
					runtimeRegistry: {},
					initialEditorMode: 'edit',
				},
				installed
			);
			try {
				const code = blockType === 'module' ? ['module test', 'moduleEnd'] : ['note test', 'noteEnd'];
				const block = createMockCodeBlock({ code, blockType, entry: 'main' });
				store.getState().codeBlockRendering.rootCodeBlocks.push(block);
				events.dispatch('contextmenu', { x: 16, y: 16 });
				await Promise.resolve();
				expect(
					store.getState().contextMenu.items.some(item => item.action === 'toggleModuleSkipExecutionDirective')
				).toBe(visible);
			} finally {
				dispose();
			}
		}
	);

	it('opens the clicked block menu and toggles that block through the menu action', async () => {
		const events = createEvents();
		const { store, dispose } = setupState(events, {
			callbacks: { loadSession: async () => null },
			runtimeRegistry: {},
			initialEditorMode: 'edit',
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
			dispose();
		}
	});

	it('works through editor initialization and schedules compilation of the updated source', async () => {
		vi.useFakeTimers();
		const events = createEvents();
		const compileCode = vi.fn().mockRejectedValue({ message: 'Test diagnostic', line: { lineNumber: 0 }, context: {} });
		const { store, dispose } = setupState(events, {
			callbacks: { loadSession: async () => null, compileCode },
			runtimeRegistry: {},
			initialEditorMode: 'edit',
		});
		try {
			const block = createMockCodeBlock({ code: ['module test', 'moduleEnd'], blockType: 'module', entry: 'main' });
			store.getState().codeBlockRendering.rootCodeBlocks.push(block);
			events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: block });
			await vi.advanceTimersByTimeAsync(1000);
			expect(compileCode).toHaveBeenCalledOnce();
			expect(compileCode.mock.calls[0][0].modules[0].code).toContain('#skipExecution');
		} finally {
			dispose();
		}
	});

	it('keeps editor instances independent and stops handling actions after disposal', () => {
		const firstEvents = createEvents();
		const secondEvents = createEvents();
		const options = {
			callbacks: { loadSession: async () => null },
			runtimeRegistry: {},
			initialEditorMode: 'edit' as const,
		};
		const { store: first, dispose: disposeFirst } = setupState(firstEvents, options);
		const { store: second, dispose: disposeSecond } = setupState(secondEvents, options);
		const block = createMockCodeBlock({ code: ['module test', 'moduleEnd'], blockType: 'module', entry: 'main' });
		firstEvents.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: block });
		expect(first.getState().compilerInputRevision).toBe(1);
		expect(second.getState().compilerInputRevision).toBe(0);
		disposeFirst();
		firstEvents.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: block });
		expect(block.code).toContain('#skipExecution');
		secondEvents.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: block });
		expect(block.code).not.toContain('#skipExecution');
		expect(second.getState().compilerInputRevision).toBe(1);
		disposeSecond();
	});
});
