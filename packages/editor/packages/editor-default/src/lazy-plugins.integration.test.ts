import { EventEmitter } from 'node:events';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createSessionPersistencePlugin } from '@8f4e/editor-plugin-session-persistence';
import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { createLazyPlugins } from './lazy-plugins';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function restoreSession(directive: string) {
	const project = parseProjectSource(
		[
			'8f4e/v1',
			'entry main',
			'module audio',
			'int[] points 4',
			'int value 0',
			'float left 0',
			'float right 0',
			'int[] notes 8',
			'int pressed 0',
			`; @${directive}`,
			'moduleEnd',
			'entryEnd',
		].join('\n')
	);
	const storage = { getItem: () => JSON.stringify(project), setItem: vi.fn() };
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, runtimeRegistry: {} });
	const context = {
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		drawers: createCodeBlockDrawerRegistry(),
	};
	const disposeSession = createSessionPersistencePlugin({
		storage,
		storageKey: 'session',
		restoreOnStartup: true,
	}).setup(context);
	const writeMemory = vi.fn();
	const entries = createLazyPlugins({ writeMemory }).map(entry => ({ ...entry, load: vi.fn(entry.load) }));
	const disposeLoader = createLazyPluginLoaderPlugin(entries).setup(context);
	cleanups.push(() => {
		disposeLoader();
		disposeSession();
		store.dispose();
	});
	events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
	for (const entry of entries) expect(entry.load).not.toHaveBeenCalled();
	events.dispatch('init');
	const state = store.getState();
	const block = state.codeBlockRendering.codeBlocks.find(block => block.name === 'audio')!;
	return { ...context, project, state, block, entries, writeMemory };
}

it.each([
	['plot &points 4', 'plot', 8],
	['wave &points 4', 'wave', 2],
	['wave2 &points 4', 'wave', 4],
	['wave4 &points 4', 'wave', 8],
	['meter &value', 'meter', 1],
	['bars &points 4', 'bars', 8],
	['piano &notes &pressed 48', 'piano', 6],
	['slider &value 0 100 1', 'slider', 2],
	['crossfade &left &right', 'crossfade', 2],
] as const)('loads %s after session restoration and refreshes its layout', async (directive, plugin, rows) => {
	const { block, entries } = restoreSession(directive);
	await vi.waitFor(() => expect(block.gaps.get(7)?.size).toBe(rows));
	expect(entries.filter(entry => entry.load.mock.calls.length).map(entry => entry.id)).toEqual([plugin]);
});

it.each(['switch', 'button'] as const)(
	'loads %s after restoration and uses this editor’s memory writer',
	async plugin => {
		const { project, store, state, events, drawers, block, writeMemory } = restoreSession(`${plugin} &value`);
		const compiled = await compileProject(project, { disableSharedMemory: true });
		store.set('compiler', {
			...state.compiler,
			memoryPlan: compiled.memoryPlan,
			memoryDefaultsByModuleId: compiled.memoryDefaultsByModuleId,
			compiledModules: compiled.compiledModules,
			compiledFunctions: compiled.compiledFunctions,
			projectMemoryExposuresByGroupPath: compiled.projectMemoryExposuresByGroupPath,
		});
		const buffer = new ArrayBuffer(65536);
		const memoryViews: MemoryViews = {
			int8: new Int8Array(buffer),
			uint8: new Uint8Array(buffer),
			int16: new Int16Array(buffer),
			uint16: new Uint16Array(buffer),
			int32: new Int32Array(buffer),
			float32: new Float32Array(buffer),
			float64: new Float64Array(buffer),
		};
		state.callbacks.getWordFromMemory = address => memoryViews.int32[address];
		const draw = { drawText: vi.fn(), drawFill: vi.fn() } as unknown as DrawContext;
		await vi.waitFor(() => {
			drawers.drawCodeBlock({ draw, state, codeBlock: block, memoryViews });
			expect(draw.drawText).toHaveBeenCalled();
		});
		events.dispatch('codeBlockPointerDown', {
			codeBlock: block,
			x: block.x + block.width - state.viewport.vGrid - state.viewport.x,
			y: block.y + 7 * state.viewport.hGrid - state.viewport.y + 1,
		});
		expect(writeMemory).toHaveBeenCalledWith(
			compiled.memoryPlan.modules.audio.memory.value.allocationUnitAddress,
			1,
			true
		);
	}
);
