import { compileProject, parseProjectSource } from '@8f4e/compiler';
import type { EditorPlugin } from '@8f4e/editor-core';
import initState, { applyCodeBlockSourceEdits, setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import { createEditorDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, vi } from 'vitest';
import { createEvents } from './events';
import { createDrawContextMock } from './rendering';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

export async function setup(
	plugin: EditorPlugin,
	source: string[],
	{
		installed = true,
		mode = 'edit',
		name = 'audio',
		drawers = createEditorDrawerRegistry(),
	}: {
		installed?: boolean;
		mode?: 'edit' | 'view';
		name?: string;
		drawers?: ReturnType<typeof createEditorDrawerRegistry>;
	} = {}
) {
	const text =
		source[0] === '8f4e/v1' ? source.join('\n') : ['8f4e/v1', 'entry main', ...source, 'entryEnd'].join('\n');
	const project = parseProjectSource(text);
	const compiled = await compileProject(project, { includeStackAnalysis: true });
	const pages = Math.max(1, Math.ceil(compiled.requiredMemoryBytes / 65536));
	const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
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
	const events = createEvents();
	const store = initState(events, {
		callbacks: {
			getWordFromMemory: address => memoryViews.int32[address],
		},
	});
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	events.dispatch(mode === 'edit' ? 'enterEditMode' : 'exitToViewMode');
	const state = store.getState();
	const dispose = installed
		? plugin.setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				loading: store.loading,
				drawers,
			})
		: () => {};
	cleanups.push(() => {
		dispose();
		store.dispose();
	});
	events.dispatch('loadProject', { project });
	store.set('compiler.result', { ...compiled, inputRevision: state.compilerInputRevision });
	events.dispatch(mode === 'edit' ? 'enterEditMode' : 'exitToViewMode');
	const block = state.project.activeLevel.blocks.find(block => block.name === name)!;
	store.set('project.activeLevel.blocks', [block]);
	const draw = createDrawContextMock();
	const render = () => {
		vi.mocked(draw.drawFill).mockClear();
		vi.mocked(draw.drawNumericText).mockClear();
		vi.mocked(draw.drawSprite).mockClear();
		vi.mocked(draw.startGroup).mockClear();
		drawers.drawCodeBlock({ draw, state, codeBlock: block, memoryViews });
	};
	const update = (code: string[]) => {
		applyCodeBlockSourceEdits(store, [{ codeBlock: block, code }]);
	};
	return {
		store,
		state,
		block,
		events,
		draw,
		render,
		update,
		memoryViews,
		compiled,
		run: () => (instance.exports.main as CallableFunction)(),
		dispose,
	};
}
