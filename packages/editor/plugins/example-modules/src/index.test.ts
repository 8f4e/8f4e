import { parseProjectSource } from '@8f4e/compiler';
import initState, { getCodeBlockGridWidth } from '@8f4e/editor-state';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { ADD_EXAMPLE_MODULE, EXAMPLE_MODULES_MENU } from './categoryMenu';
import { createExampleModulesPlugin } from './index';

const cleanups: Array<() => void> = [];
const publicSource = (code: string, type = 'module') =>
	`8f4e/v1\n${type === 'module' ? 'entry main\n' : ''}${code}${type === 'module' ? '\nentryEnd' : ''}`;
const mainCode = 'module target\n; @public\nuse dep\nmoduleEnd';
const dependencyCode = 'constants dep\n; @public\nconst VALUE 1\nconstantsEnd';

function setup({
	sources = new Map([
		['audio/target', vi.fn(async () => publicSource(mainCode))],
		['constants/dep', vi.fn(async () => publicSource(dependencyCode, 'constants'))],
	]),
	mode = 'edit',
	installed = true,
}: {
	sources?: ReadonlyMap<string, () => Promise<string>>;
	mode?: 'edit' | 'view';
	installed?: boolean;
} = {}) {
	const events = createEvents();
	const on = vi.spyOn(events, 'on');

	const store = initState(events, {
		callbacks: {},
	});
	let pluginCleanup = installed
		? createExampleModulesPlugin({ sources }).setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				loading: store.loading,
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
	events.dispatch('loadProject', {
		project: parseProjectSource('8f4e/v1\nconstants env\n; @pos 120 60\nconstantsEnd'),
	});
	events.dispatch(mode === 'edit' ? 'enterEditMode' : 'exitToViewMode');
	const state = store.getState();
	const addModule = (slug = 'target', x = 100, y = 112) =>
		on.mock.calls.find(([name]) => name === ADD_EXAMPLE_MODULE)![1]({ slug, x, y });
	return { events, state, disposePlugin, addModule };
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

describe('example modules plugin', () => {
	it('opens categories through contributed menu items, supports Back, and inserts the selected module and dependency', async () => {
		const test = setup();
		test.events.dispatch('contextmenu', { x: 100, y: 112 });
		await vi.waitFor(() =>
			expect(test.state.contextMenu.items.some(item => item.title?.includes('Add Built-in Block'))).toBe(true)
		);
		const click = (title: string) => {
			const menuItemIndex = test.state.contextMenu.items.findIndex(item => item.title?.includes(title));
			test.events.dispatch('activateContextMenuItem', { x: 100, y: 112, index: menuItemIndex });
		};
		click('Add Built-in Block');
		await vi.waitFor(() => expect(test.state.contextMenu.items.some(item => item.title?.includes('Audio'))).toBe(true));
		click('Audio');
		await vi.waitFor(() =>
			expect(test.state.contextMenu.items.some(item => item.action === ADD_EXAMPLE_MODULE)).toBe(true)
		);
		click('Back');
		await vi.waitFor(() => expect(test.state.contextMenu.items.some(item => item.title?.includes('Audio'))).toBe(true));
		click('Audio');
		await vi.waitFor(() =>
			expect(test.state.contextMenu.items.some(item => item.action === ADD_EXAMPLE_MODULE)).toBe(true)
		);
		click('Back');
		await vi.waitFor(() => expect(test.state.contextMenu.items.some(item => item.title?.includes('Audio'))).toBe(true));
		click('Audio');
		await vi.waitFor(() =>
			expect(test.state.contextMenu.items.some(item => item.action === ADD_EXAMPLE_MODULE)).toBe(true)
		);
		click('Target');
		await vi.waitFor(() =>
			expect(test.state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual([
				'env',
				'target',
				'dep',
			])
		);
		expect(test.state.contextMenu.open).toBe(false);
		const [target, dep] = test.state.codeBlockRendering.currentProject.blocks.slice(1);
		expect(target.code).not.toContain('; @public');
		expect(target.gridX).toBe(Math.round((test.state.viewport.x + 100) / test.state.viewport.vGrid));
		expect(dep.gridX).toBe(
			target.gridX + getCodeBlockGridWidth(mainCode.split('\n').filter(line => line !== '; @public')) + 4
		);
		expect(dep.gridY).toBe(target.gridY);
	});

	it('skips existing dependencies while preserving repeated module names', async () => {
		const test = setup();
		await test.addModule();
		await test.addModule();
		expect(test.state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual([
			'env',
			'target',
			'dep',
			'target',
		]);
	});

	it('does not confuse a dependency with a different block type of the same name', async () => {
		const test = setup();
		test.events.dispatch('insertCodeBlock', { code: ['module dep', 'moduleEnd'], x: 400, y: 100 });
		await test.addModule();
		expect(
			test.state.codeBlockRendering.currentProject.blocks
				.filter(block => block.name === 'dep')
				.map(block => block.blockType)
		).toEqual(['module', 'constants']);
	});

	it('loads a module without dependencies', async () => {
		const test = setup({
			sources: new Map([['audio/simple', async () => publicSource('module simple\n; @public\nmoduleEnd')]]),
		});
		await test.addModule('simple');
		expect(test.state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual(['env', 'simple']);
	});

	it('inserts a public configuration note without creating executable modules', async () => {
		const test = setup({
			sources: new Map([
				[
					'settings/sample',
					async () => '8f4e/v1\nnote sampleSettings\n; @public\n; @config testSetting sample\nnoteEnd',
				],
			]),
		});
		await test.addModule('sample');

		expect(test.state.codeBlockRendering.currentProject.blocks.map(block => block.blockType)).toEqual([
			'constants',
			'note',
		]);
		expect(test.state.codeBlockRendering.currentProject.blocks[1].name).toBe('sampleSettings');
		expect(test.state.codeBlockRendering.currentProject.blocks[1].code).not.toContain('; @public');
		expect(test.state.codeBlockRendering.currentProject.blocks[1].code).toContain('; @config testSetting sample');
	});

	it('continues inserting available dependencies when one chunk fails', async () => {
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const test = setup({
			sources: new Map([
				['audio/target', async () => publicSource('module target\n; @public\nuse unavailable\nuse dep\nmoduleEnd')],
				[
					'constants/unavailable',
					async () => {
						throw new Error('Chunk unavailable');
					},
				],
				['constants/dep', async () => publicSource(dependencyCode, 'constants')],
			]),
		});
		await test.addModule();
		expect(test.state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual([
			'env',
			'target',
			'dep',
		]);
		expect(warning).toHaveBeenCalledWith('Failed to load dependency: unavailable', expect.any(Error));
	});

	it('hides the menu and does not load source in view mode', async () => {
		const load = vi.fn(async () => publicSource(mainCode));
		const test = setup({ mode: 'view', sources: new Map([['audio/target', load]]) });
		test.events.dispatch('contextmenu', { x: 100, y: 112 });
		await Promise.resolve();
		expect(test.state.contextMenu.open).toBe(true);
		expect(test.state.contextMenu.items.some(item => item.payload?.menu === EXAMPLE_MODULES_MENU)).toBe(false);
		await test.addModule();
		expect(load).not.toHaveBeenCalled();
	});

	it.each([false, true])(
		'removes the main menu contribution when omitted or disposed: installed=%s',
		async installed => {
			const test = setup({ installed });
			if (installed) test.disposePlugin();
			test.events.dispatch('contextmenu', { x: 100, y: 112 });
			await Promise.resolve();
			expect(test.state.contextMenu.items.some(item => item.payload?.menu === EXAMPLE_MODULES_MENU)).toBe(false);
			test.events.dispatch(ADD_EXAMPLE_MODULE, { slug: 'target', x: 100, y: 112 });
			expect(test.state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual(['env']);
		}
	);

	it('does not insert source whose load finishes after disposal', async () => {
		let finish!: (source: string) => void;
		const pending = new Promise<string>(resolve => {
			finish = resolve;
		});
		const test = setup({ sources: new Map([['audio/target', () => pending]]) });
		const insertion = test.addModule();
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
			{ id: 'module:target', message: 'Loading module target...', status: 'loading' },
		]);
		test.disposePlugin();
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		finish(publicSource(mainCode));
		await insertion;
		expect(test.state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual(['env']);
	});

	it('does not insert a dependency whose load finishes after disposal', async () => {
		let finish!: (source: string) => void;
		const pending = new Promise<string>(resolve => {
			finish = resolve;
		});
		const loadDependency = vi.fn(() => pending);
		const test = setup({
			sources: new Map([
				['audio/target', async () => publicSource(mainCode)],
				['constants/dep', loadDependency],
			]),
		});
		const insertion = test.addModule();
		await vi.waitFor(() => expect(loadDependency).toHaveBeenCalledOnce());
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
			{ id: 'module:dep', message: 'Loading module dep...', status: 'loading' },
		]);
		test.disposePlugin();
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		finish(publicSource(dependencyCode, 'constants'));
		await insertion;
		expect(test.state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual(['env', 'target']);
	});

	it('isolates menus, source caches, and disposal between editors', async () => {
		const load = vi.fn(async () => publicSource('module target\n; @public\nmoduleEnd'));
		const sources = new Map([['audio/target', load]]);
		const first = setup({ sources });
		const second = setup({ sources });
		await first.addModule();
		first.disposePlugin();
		await second.addModule();
		expect(load).toHaveBeenCalledTimes(2);
		expect(second.state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual(['env', 'target']);
	});
});
