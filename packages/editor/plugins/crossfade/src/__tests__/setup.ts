import { compileProject, parseProjectSource } from '@8f4e/compiler';
import type { EditorPlugin } from '@8f4e/editor-core';
import initState from '@8f4e/editor-state';
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
	createPlugin: (options: {
		writeMemory: (address: number, value: number, isInteger: boolean) => void;
	}) => EditorPlugin,
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
	const events = createEvents();
	const writeMemory = vi.fn((address: number, value: number, isInteger: boolean) => {
		memoryViews[isInteger ? 'int32' : 'float32'][address] = value;
	});
	const store = initState(events, {
		callbacks: {
			getWordFromMemory: address => memoryViews.int32[address],
		},
	});
	events.dispatch(mode === 'edit' ? 'enterEditMode' : 'exitToViewMode');
	const state = store.getState();
	const dispose = installed
		? createPlugin({ writeMemory }).setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				drawers,
			})
		: () => {};
	cleanups.push(() => {
		dispose();
		store.dispose();
	});
	state.compiler.result.memoryPlan = compiled.memoryPlan;
	state.compiler.result.memoryDefaultsByModuleId = compiled.memoryDefaultsByModuleId;
	state.compiler.result.compiledModules = compiled.compiledModules;
	state.compiler.result.compiledFunctions = compiled.compiledFunctions;
	state.compiler.result.projectMemoryExposuresByGroupPath = compiled.projectMemoryExposuresByGroupPath;
	events.dispatch('loadProject', { project });
	events.dispatch(mode === 'edit' ? 'enterEditMode' : 'exitToViewMode');
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === name)!;
	store.set('codeBlockRendering.currentProject.blocks', [block]);
	const draw = createDrawContextMock();
	const render = () => {
		vi.mocked(draw.drawFill).mockClear();
		vi.mocked(draw.drawText).mockClear();
		vi.mocked(draw.drawCharacter).mockClear();
		vi.mocked(draw.startGroup).mockClear();
		drawers.drawCodeBlock({ draw, state, codeBlock: block, memoryViews });
		drawers.drawCodeBlockOverlay({ draw, state, codeBlock: block, memoryViews });
	};
	const update = (code: string[]) => {
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block);
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', code);
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
		dispose,
		writeMemory,
	};
}
