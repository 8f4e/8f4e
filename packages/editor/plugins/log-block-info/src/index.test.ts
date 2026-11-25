import { EventEmitter } from 'node:events';
import type { EditorCodeBlock } from '@8f4e/editor-core';
import initState, { EMPTY_DEFAULT_PROJECT, setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import { createEditorRenderRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logBlockInfoPlugin } from './index';

const action = 'consoleLog';
const cleanups: Array<() => void> = [];

function setup(code = ['module target', 'moduleEnd'], installed = true) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	let cleanup = installed
		? logBlockInfoPlugin.setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				loading: store.loading,
				renderRegistry: createEditorRenderRegistry(),
			})
		: undefined;
	const disposePlugin = () => {
		cleanup?.();
		cleanup = undefined;
	};
	cleanups.push(store.dispose, disposePlugin);
	const state = store.getState();
	setGridSize(state, events, TEST_GRID_SIZE);
	events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
	events.dispatch('enterEditMode');
	const {
		insertedBlocks: [block, other],
	} = store.projectTransactions.apply({
		inserts: [
			{
				targetLevel: state.project.rootLevel,
				source: {
					code: [code[0], '; @pos 12 10', ...code.slice(1)],
					...(code[0].startsWith('group ') ? { childLevel: { entries: [], blocks: [] } } : {}),
				},
			},
			{ targetLevel: state.project.rootLevel, source: { code: ['note other', '; @pos 40 10', 'noteEnd'] } },
		],
	});
	const openMenu = async (target: EditorCodeBlock = block) => {
		const position = { x: target.x - state.viewport.x + 8, y: target.y - state.viewport.y + 8 };
		events.dispatch('contextmenu', position);
		await Promise.resolve();
		return { items: state.contextMenu.items, position };
	};
	return { state, store, events, block, other, openMenu, disposePlugin };
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

describe('log block info plugin', () => {
	it.each([
		['module', ['module target', 'moduleEnd']],
		['function', ['function target', 'functionEnd']],
		['note', ['note target', 'noteEnd']],
		['group', ['group target', 'groupEnd']],
		['module', ['constants target', 'constantsEnd']],
	] as const)('contributes the inspection label for %s', async (label, source) => {
		const test = setup([...source]);
		expect((await test.openMenu()).items).toContainEqual({
			title: `Log ${label} info to console`,
			action,
			payload: { codeBlock: test.block },
			close: true,
		});
	});

	it('logs the clicked block and closes the menu without editing the project', async () => {
		const test = setup();
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		test.store.set('project.selectedCodeBlock', test.other);
		const revision = test.state.projectChange.revision;
		const { items, position } = await test.openMenu();
		test.events.dispatch('activateContextMenuItem', {
			index: items.findIndex(item => item.action === action),
			...position,
		});
		expect(log).toHaveBeenCalledExactlyOnceWith({ codeBlock: test.block, ...position });
		expect(test.state.contextMenu.open).toBe(false);
		expect(test.state.project.selectedCodeBlock).toBe(test.other);
		expect(test.state.projectChange.revision).toBe(revision);
	});

	it('allows inspection in view mode and for read-only blocks', async () => {
		const test = setup();
		test.events.dispatch('exitToViewMode');
		expect((await test.openMenu()).items.some(item => item.action === action)).toBe(true);
		const environment = test.state.project.rootLevel.blocks.find(block => block.name === 'env')!;
		expect(environment.readOnly).toBe(true);
		expect((await test.openMenu(environment)).items.some(item => item.action === action)).toBe(true);
	});

	it.each([false, true])(
		'removes menu and event registrations without a live installation: installed=%s',
		async installed => {
			const test = setup(undefined, installed);
			const log = vi.spyOn(console, 'log').mockImplementation(() => {});
			test.disposePlugin();
			expect((await test.openMenu()).items.some(item => item.action === action)).toBe(false);
			test.events.dispatch(action, { codeBlock: test.block });
			expect(log).not.toHaveBeenCalled();
		}
	);
});
