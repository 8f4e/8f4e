import { EventEmitter } from 'node:events';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import initState from '@8f4e/editor-state';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { createLazyPluginRegistry } from './lazy-plugins';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

it.each([
	['watch', 'stack'],
	['w', 's'],
])('lazily loads @%s and @%s on group navigation and draws them after existing drawers', async (watch, stack) => {
	const project = parseProjectSource(`8f4e/v1
entry main
group nested
entry main
module audio
int value 7 ; @${watch}
push 3 ; @${stack}
drop
moduleEnd
entryEnd
groupEnd
entryEnd`);
	const compiled = await compileProject(project, { disableSharedMemory: true, includeStackAnalysis: true });
	const pages = Math.max(1, Math.ceil(compiled.requiredMemoryBytes / 65536));
	const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
	const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as CallableFunction)();
	const memoryViews: MemoryViews = {
		int8: new Int8Array(memory.buffer),
		uint8: new Uint8Array(memory.buffer),
		int16: new Int16Array(memory.buffer),
		uint16: new Uint16Array(memory.buffer),
		int32: new Int32Array(memory.buffer),
		float32: new Float32Array(memory.buffer),
		float64: new Float64Array(memory.buffer),
	};
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	Object.assign(state.compiler.result, compiled);
	const drawers = createEditorDrawerRegistry();
	const drawn: string[] = [];
	const removeFirstDrawer = drawers.registerCodeBlockDrawer(() => drawn.push('first'));
	let finishLoading!: () => void;
	const pending = new Promise<void>(resolve => {
		finishLoading = resolve;
	});
	const entries = createLazyPluginRegistry({
		inputTarget: new EventTarget() as HTMLElement,
		prefersReducedMotion: () => true,
		navigator: {} as Navigator,
		writeMemory: () => {},
		getMemory: () => memory,
		getCodeBuffer: () => compiled.codeBuffer,
		getAssertionSites: () => undefined,
	}).map(entry => ({ ...entry, load: vi.fn(() => pending.then(entry.load)) }));
	const disposeLoader = createLazyPluginLoaderPlugin(entries).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		drawers,
	});
	cleanups.push(() => {
		finishLoading();
		disposeLoader();
		removeFirstDrawer();
		store.dispose();
	});
	events.dispatch('loadProject', { project });
	await Promise.resolve();
	for (const entry of entries) expect(entry.load).not.toHaveBeenCalled();
	const group = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'nested')!;
	events.dispatch('openProjectGroup', { codeBlock: group });
	await vi.waitFor(() =>
		expect(entries.filter(entry => entry.load.mock.calls.length).map(entry => entry.id)).toEqual(['watch', 'stack'])
	);
	const codeBlock = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'audio')!;
	const draw = {
		startGroup: () => {},
		endGroup: () => {},
		drawFill: () => {},
		drawCharacter: () => {},
		drawText: (_x: number, _y: number, text: string) => drawn.push(text),
	} as unknown as DrawContext;
	const render = () => {
		drawn.length = 0;
		const context = { draw, state, codeBlock, memoryViews };
		drawers.drawCodeBlock(context);
		return drawn;
	};
	expect(render()).toEqual(['first']);
	finishLoading();
	await vi.waitFor(() => {
		expect(render().slice(1).sort()).toEqual(['3', '7']);
		expect(drawn[0]).toBe('first');
	});
	events.dispatch('goToRootProjectGroup');
	events.dispatch('openProjectGroup', { codeBlock: group });
	await Promise.resolve();
	for (const entry of entries.filter(entry => ['watch', 'stack'].includes(entry.id)))
		expect(entry.load).toHaveBeenCalledOnce();
	disposeLoader();
	expect(render()).toEqual(['first']);
});
