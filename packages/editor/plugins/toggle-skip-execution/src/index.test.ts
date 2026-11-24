import initState, { setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { EventDispatcher, Options } from '@8f4e/editor-state-types';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
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
		dispatch: (name, ...[payload]) => {
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
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	const disposePlugin = installed
		? toggleSkipExecutionPlugin.setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				loading: store.loading,
				drawers: createEditorDrawerRegistry(),
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
		callbacks: {},
	});
	events.dispatch('enterEditMode');
	const state = store.getState();
	const codeBlock = insertSource(store, code);
	return {
		state,
		store,
		events,
		codeBlock,
		dispose,
		initialCompilerRevision: state.compilerInputRevision,
		initialProjectRevision: state.projectChange.revision,
		initialTimestamp: codeBlock.lastUpdated,
	};
}

function insertSource(store: ReturnType<typeof initState>, code: string[]) {
	const project = store.getState().project.activeLevel;
	return store.projectTransactions.apply({ inserts: [{ project, source: { code } }] }).insertedBlocks[0];
}

describe('toggle skip execution plugin', () => {
	afterEach(() => {
		while (cleanups.length) cleanups.pop()!();
		vi.useRealTimers();
	});

	it('inserts the directive, publishes the source edit, and advances the compiler revision', () => {
		vi.useFakeTimers();
		vi.setSystemTime(1000);
		const context = createContext();
		const { state, store, events, codeBlock } = context;
		const revisions: string[][] = [];
		store.subscribe('compilerInputRevision', () => revisions.push([...codeBlock.code]));
		vi.setSystemTime(2000);
		events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock });
		expect(codeBlock.code).toEqual(['module test', '#skipExecution', '', 'moduleEnd']);
		expect(codeBlock.lastUpdated).toBeGreaterThan(context.initialTimestamp);
		expect(state.compilerInputRevision).toBe(context.initialCompilerRevision + 1);
		expect(state.projectChange.revision).toBe(context.initialProjectRevision + 1);
		expect(revisions).toEqual([codeBlock.code]);
		events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock });
		expect(codeBlock.code).toEqual(['module test', '', 'moduleEnd']);
		expect(state.compilerInputRevision).toBe(context.initialCompilerRevision + 2);
		expect(state.projectChange.revision).toBe(context.initialProjectRevision + 2);
	});

	it.each([['#skipExecution'], ['  #skipExecution'], ['#skipExecution  '], ['#skipExecution', '', '#skipExecution']])(
		'removes existing directives including whitespace and duplicates: %j',
		(...lines) => {
			const context = createContext(['module test', ...lines, 'moduleEnd']);
			context.events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: context.codeBlock });
			expect(context.codeBlock.code).toEqual(['module test', ...lines.filter(line => line === ''), 'moduleEnd']);
			expect(context.state.compilerInputRevision).toBe(context.initialCompilerRevision + 1);
		}
	);

	it('does not edit source or advance the compiler revision in view mode', () => {
		const context = createContext();
		context.state.editorMode = 'view';
		context.events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: context.codeBlock });
		expect(context.codeBlock.code).toEqual(['module test', '', 'moduleEnd']);
		expect(context.codeBlock.lastUpdated).toBe(context.initialTimestamp);
		expect(context.state.compilerInputRevision).toBe(context.initialCompilerRevision);
		expect(context.state.projectChange.revision).toBe(context.initialProjectRevision);
	});

	it('ignores malformed source without publishing an edit', () => {
		const context = createContext(['invalid']);
		context.events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: context.codeBlock });
		expect(context.codeBlock.lastUpdated).toBe(context.initialTimestamp);
		expect(context.state.compilerInputRevision).toBe(context.initialCompilerRevision);
		expect(context.state.projectChange.revision).toBe(context.initialProjectRevision);
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
					callbacks: {},
				},
				installed
			);
			events.dispatch('enterEditMode');
			try {
				const code = blockType === 'module' ? ['module test', 'moduleEnd'] : ['note test', 'noteEnd'];
				insertSource(store, code);
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
			callbacks: {},
		});
		events.dispatch('enterEditMode');
		try {
			const block = insertSource(store, ['module target', 'moduleEnd']);
			const selected = insertSource(store, ['module other', '; @pos 40 0', 'moduleEnd']);
			const state = store.getState();
			store.set('project.selectedCodeBlock', selected);
			events.dispatch('contextmenu', { x: 16, y: 16 });
			await Promise.resolve();
			const index = state.contextMenu.items.findIndex(item => item.action === 'toggleModuleSkipExecutionDirective');
			expect(index).toBeGreaterThanOrEqual(0);
			expect(state.contextMenu.items[index].payload?.codeBlock).toBe(block);
			events.dispatch('activateContextMenuItem', { x: 16, y: 16, index });
			expect(state.contextMenu.open).toBe(false);
			expect(block.code).toContain('#skipExecution');
			expect(selected.code).not.toContain('#skipExecution');
			events.dispatch('contextmenu', { x: 16, y: 16 });
			await Promise.resolve();
			expect(
				state.contextMenu.items.find(item => item.action === 'toggleModuleSkipExecutionDirective')?.title
			).toContain('Unskip module');
			store.set('editorMode', 'view');
			events.dispatch('contextmenu', { x: 16, y: 16 });
			await Promise.resolve();
			expect(state.contextMenu.items.some(item => item.action === 'toggleModuleSkipExecutionDirective')).toBe(false);
		} finally {
			dispose();
		}
	});

	it('announces updated inputs through editor initialization', () => {
		const events = createEvents();
		const changed = vi.fn();
		const { store, dispose } = setupState(events, {
			callbacks: {},
		});
		store.subscribe('compilerInputRevision', changed);
		events.dispatch('enterEditMode');
		try {
			const block = insertSource(store, ['module test', 'moduleEnd']);
			changed.mockClear();
			changed.mockImplementation(() => [...block.code]);
			events.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: block });
			expect(changed).toHaveBeenCalledOnce();
			expect(changed.mock.results[0].value).toContain('#skipExecution');
		} finally {
			dispose();
		}
	});

	it('keeps editor instances independent and stops handling actions after disposal', () => {
		const firstEvents = createEvents();
		const secondEvents = createEvents();
		const options = {
			callbacks: {},
		};
		const { store: first, dispose: disposeFirst } = setupState(firstEvents, options);
		firstEvents.dispatch('enterEditMode');
		const { store: second, dispose: disposeSecond } = setupState(secondEvents, options);
		secondEvents.dispatch('enterEditMode');
		const firstBlock = insertSource(first, ['module test', 'moduleEnd']);
		const secondBlock = insertSource(second, ['module test', 'moduleEnd']);
		const firstRevision = first.getState().compilerInputRevision;
		const secondRevision = second.getState().compilerInputRevision;
		firstEvents.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: firstBlock });
		expect(firstBlock.code).toContain('#skipExecution');
		expect(secondBlock.code).not.toContain('#skipExecution');
		expect(first.getState().compilerInputRevision).toBe(firstRevision + 1);
		expect(second.getState().compilerInputRevision).toBe(secondRevision);
		disposeFirst();
		firstEvents.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: firstBlock });
		expect(firstBlock.code).toContain('#skipExecution');
		secondEvents.dispatch('toggleModuleSkipExecutionDirective', { codeBlock: secondBlock });
		expect(secondBlock.code).toContain('#skipExecution');
		expect(second.getState().compilerInputRevision).toBe(secondRevision + 1);
		disposeSecond();
	});
});
