import { EventEmitter } from 'node:events';
import type { EditorCodeBlock } from '@8f4e/editor-core';
import initState, { EMPTY_DEFAULT_PROJECT, setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import { createEditorRenderRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toggleDisabledPlugin } from './index';

const action = 'toggleCodeBlockDisabled';
const cleanups: Array<() => void> = [];

function setup(code = ['module target', 'moduleEnd']) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	const context = {
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		renderRegistry: createEditorRenderRegistry(),
	};
	let cleanup: (() => void) | undefined = toggleDisabledPlugin.setup(context);
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
});

describe('toggle disabled plugin', () => {
	it.each([false, true])('toggles source and derived state from disabled=%s as one project edit', disabled => {
		const test = setup(['module target', ...(disabled ? ['; @disabled'] : []), 'moduleEnd']);
		const { block, state, store, events } = test;
		const changes = vi.fn();
		store.subscribe('projectChange', changes);
		const revision = state.projectChange.revision;
		const compilerRevision = state.compilerInputRevision;
		expect(block.disabled).toBe(disabled);
		block.lastUpdated = 1000;
		events.dispatch(action, { codeBlock: block });
		expect(block.disabled).toBe(!disabled);
		expect(block.code.includes('; @disabled')).toBe(!disabled);
		expect(block.code).toContain('; @pos 12 10');
		expect(block.lastUpdated).toBeGreaterThan(1000);
		expect(changes).toHaveBeenCalledOnce();
		expect(state.projectChange.revision).toBe(revision + 1);
		expect(state.compilerInputRevision).toBe(compilerRevision + 1);
	});

	it.each([
		['module', ['module target', 'moduleEnd']],
		['function', ['function target', 'functionEnd']],
		['note', ['note target', 'noteEnd']],
		['constants', ['constants target', 'constantsEnd']],
		['includes', ['includes', 'includesEnd']],
		['unknown', ['int value 1']],
	] as const)('contributes the correct label for %s', async (label, source) => {
		const test = setup([...source]);
		expect((await test.openMenu()).items).toContainEqual({
			title: `Disable ${label}`,
			action,
			payload: { codeBlock: test.block },
			close: true,
		});
	});

	it('does not toggle structural groups', async () => {
		const test = setup(['group target', 'groupEnd']);
		const revision = test.state.projectChange.revision;
		expect((await test.openMenu()).items.some(item => item.action === action)).toBe(false);
		test.events.dispatch(action, { codeBlock: test.block });
		expect(test.block.disabled).toBe(false);
		expect(test.block.code).not.toContain('; @disabled');
		expect(test.state.projectChange.revision).toBe(revision);
	});

	it('toggles the clicked block rather than the selected block and updates the menu label', async () => {
		const test = setup();
		test.store.set('project.selectedCodeBlock', test.other);
		const { items, position } = await test.openMenu();
		test.events.dispatch('activateContextMenuItem', {
			index: items.findIndex(item => item.action === action),
			...position,
		});
		expect(test.state.contextMenu.open).toBe(false);
		expect(test.block.disabled).toBe(true);
		expect(test.other.disabled).toBe(false);
		expect((await test.openMenu()).items.find(item => item.action === action)?.title).toBe('Enable module');
	});

	it('ignores actions in view mode and for read-only blocks', async () => {
		const test = setup();
		const revision = test.state.projectChange.revision;
		test.events.dispatch('exitToViewMode');
		expect((await test.openMenu()).items.some(item => item.action === action)).toBe(false);
		test.events.dispatch(action, { codeBlock: test.block });
		expect(test.block.disabled).toBe(false);
		test.events.dispatch('enterEditMode');
		const environment = test.state.project.rootLevel.blocks.find(block => block.name === 'env')!;
		expect(environment.readOnly).toBe(true);
		expect((await test.openMenu(environment)).items.some(item => item.action === action)).toBe(false);
		test.events.dispatch(action, { codeBlock: environment });
		expect(environment.disabled).toBe(false);
		expect(test.state.projectChange.revision).toBe(revision);
	});

	it('removes action and menu registrations on disposal', async () => {
		const test = setup();
		test.disposePlugin();
		expect((await test.openMenu()).items.some(item => item.action === action)).toBe(false);
		test.events.dispatch(action, { codeBlock: test.block });
		expect(test.block.disabled).toBe(false);
	});
});
