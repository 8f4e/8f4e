import { parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { removeMemoryConnectionsPlugin } from './index';

const cleanups: Array<() => void> = [];

function setup(
	code = ['module target', 'float value &other:output', 'moduleEnd'],
	installed = true,
	mode: 'edit' | 'view' = 'edit'
) {
	const events = createEvents();
	const saveSession = vi.fn().mockResolvedValue(undefined);
	const store = initState(events, {
		callbacks: { loadSession: async () => null, saveSession },
		runtimeRegistry: {},
		initialEditorMode: mode,
	});
	const disposePlugin = installed
		? removeMemoryConnectionsPlugin.setup({
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
	events.dispatch('loadProject', {
		project: parseProjectSource(
			`8f4e/v1\nconstants env\n; @pos 120 60\nconstantsEnd\nentry main\n${code.join('\n')}\nentryEnd`
		),
	});
	const state = store.getState();
	const block = state.codeBlockRendering.rootCodeBlocks.find(candidate => candidate.name === 'target')!;
	saveSession.mockClear();
	const openMenu = async () => {
		events.dispatch('contextmenu', { x: block.x + 8, y: block.y + 8 });
		await Promise.resolve();
	};
	return { store, state, events, block, saveSession, disposePlugin, openMenu };
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.useRealTimers();
});

describe('remove memory connections plugin', () => {
	it('publishes the edited source before advancing compilation, and ignores repeated removal', () => {
		const test = setup();
		const revision = test.state.compilerInputRevision;
		const sources: string[][] = [];
		test.store.subscribe('compilerInputRevision', () => sources.push([...test.block.code]));
		test.block.lastUpdated = 0;
		test.events.dispatch('removeConnections', { codeBlock: test.block });
		expect(test.block.code).toEqual(['module target', 'float value', 'moduleEnd']);
		expect(test.block.lastUpdated).toBeGreaterThan(0);
		expect(test.state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBe(test.block);
		expect(test.state.compilerInputRevision).toBe(revision + 1);
		expect(sources).toEqual([test.block.code]);
		expect(test.saveSession).toHaveBeenCalledOnce();
		test.events.dispatch('removeConnections', { codeBlock: test.block });
		expect(test.state.compilerInputRevision).toBe(revision + 1);
		expect(test.saveSession).toHaveBeenCalledOnce();
	});

	it('targets the clicked block through the menu and disables the action after removal', async () => {
		const test = setup();
		const other = test.state.codeBlockRendering.rootCodeBlocks.find(block => block !== test.block)!;
		test.state.codeBlockRendering.selectedCodeBlock = other;
		const originalOtherCode = [...other.code];
		await test.openMenu();
		const index = test.state.contextMenu.items.findIndex(item => item.action === 'removeConnections');
		expect(index).toBeGreaterThanOrEqual(0);
		expect(test.state.contextMenu.items[index]).toMatchObject({
			title: expect.stringContaining('Remove connections'),
			payload: { codeBlock: test.block },
			disabled: false,
		});
		test.state.contextMenu.highlightedItem = index;
		test.events.dispatch('mousedown', { x: test.block.x + 8, y: test.block.y + 8, stopPropagation: false });
		expect(test.state.contextMenu.open).toBe(false);
		expect(test.block.code[1]).toBe('float value');
		expect(other.code).toEqual(originalOtherCode);
		await test.openMenu();
		expect(test.state.contextMenu.items.find(item => item.action === 'removeConnections')?.disabled).toBe(true);
	});

	it('leaves local references unchanged and disables the menu action', async () => {
		const code = ['module target', 'float value &local', 'moduleEnd'];
		const test = setup(code);
		const revision = test.state.compilerInputRevision;
		await test.openMenu();
		expect(test.state.contextMenu.items.find(item => item.action === 'removeConnections')?.disabled).toBe(true);
		test.events.dispatch('removeConnections', { codeBlock: test.block });
		expect(test.block.code).toEqual(code);
		expect(test.state.compilerInputRevision).toBe(revision);
		expect(test.saveSession).not.toHaveBeenCalled();
	});

	it('schedules compilation with the disconnected source', async () => {
		vi.useFakeTimers();
		const test = setup();
		await vi.advanceTimersByTimeAsync(1000);
		const compileCode = vi.fn().mockRejectedValue({ message: 'Test diagnostic', line: { lineNumber: 0 }, context: {} });
		test.state.callbacks.compileCode = compileCode;
		test.events.dispatch('removeConnections', { codeBlock: test.block });
		await vi.advanceTimersByTimeAsync(1000);
		expect(compileCode).toHaveBeenCalledOnce();
		expect(compileCode.mock.calls[0][0].modules[0].code).toEqual(test.block.code);
	});

	it('hides the action and does not edit in view mode', async () => {
		const test = setup(undefined, true, 'view');
		const code = [...test.block.code];
		const revision = test.state.compilerInputRevision;
		await test.openMenu();
		expect(test.state.contextMenu.items.some(item => item.action === 'removeConnections')).toBe(false);
		test.events.dispatch('removeConnections', { codeBlock: test.block });
		expect(test.block.code).toEqual(code);
		expect(test.state.compilerInputRevision).toBe(revision);
	});

	it.each([false, true])('has no menu or handler when omitted or disposed: installed=%s', async installed => {
		const test = setup(undefined, installed);
		if (installed) test.disposePlugin();
		const code = [...test.block.code];
		await test.openMenu();
		expect(test.state.contextMenu.items.some(item => item.action === 'removeConnections')).toBe(false);
		test.events.dispatch('removeConnections', { codeBlock: test.block });
		expect(test.block.code).toEqual(code);
		expect(test.saveSession).not.toHaveBeenCalled();
	});

	it('keeps actions isolated between editor instances', () => {
		const first = setup();
		const second = setup();
		first.events.dispatch('removeConnections', { codeBlock: first.block });
		expect(first.block.code[1]).toBe('float value');
		expect(second.block.code[1]).toBe('float value &other:output');
		first.disposePlugin();
		second.events.dispatch('removeConnections', { codeBlock: second.block });
		expect(second.block.code[1]).toBe('float value');
	});
});
