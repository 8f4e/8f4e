import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { createMemoryViewManager } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState, { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import type { EventDispatcher } from '@8f4e/editor-state-types';
import { createEditorDrawerRegistry, type DrawContext } from '@8f4e/web-ui';
import { afterEach, vi } from 'vitest';
import { createScopePlugin } from '../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.useRealTimers();
});

function createEvents(): EventDispatcher {
	const listeners = new Map<string, Set<(event: unknown) => void>>();
	return {
		on: (name, listener) => {
			if (!listeners.has(name)) listeners.set(name, new Set());
			listeners.get(name)!.add(listener as (event: unknown) => void);
		},
		off: (name, listener) => {
			listeners.get(name)?.delete(listener as (event: unknown) => void);
		},
		dispatch: (name, ...[event]) => {
			for (const listener of listeners.get(name) ?? []) listener(event);
		},
	};
}

export async function setup(
	source: string[],
	{
		installed = true,
		name = 'audio',
		compile = true,
		drawers = createEditorDrawerRegistry(),
	}: {
		installed?: boolean;
		name?: string;
		compile?: boolean;
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
	const { memoryViews, updateMemoryViews } = createMemoryViewManager(memory);
	let currentMemory: WebAssembly.Memory | null = memory;
	const getMemory = vi.fn(() => currentMemory);
	const events = createEvents();
	const store = initState(events, { callbacks: { getWordFromMemory: address => memoryViews.int32[address] } });
	const state = store.getState();
	const dispose = installed
		? createScopePlugin({ getMemory }).setup({
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
	events.dispatch('enterEditMode');
	const acceptCompilation = () => {
		store.set('compiler.result', {
			inputRevision: state.compilerInputRevision,
			memoryPlan: compiled.memoryPlan,
			memoryDefaultsByModuleId: compiled.memoryDefaultsByModuleId,
			compiledModules: compiled.compiledModules,
			compiledFunctions: compiled.compiledFunctions,
			projectMemoryExposuresByGroupPath: compiled.projectMemoryExposuresByGroupPath,
		});
		store.set('compiler.isCompiling', false);
	};
	if (compile) acceptCompilation();
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === name)!;
	const draw = {
		startGroup: vi.fn(),
		endGroup: vi.fn(),
		drawFill: vi.fn(),
	} as unknown as DrawContext;
	const render = (codeBlock = block) => {
		vi.mocked(draw.drawFill).mockClear();
		vi.mocked(draw.startGroup).mockClear();
		vi.mocked(draw.endGroup).mockClear();
		drawers.drawCodeBlock({ draw, state, renderedBlock: { codeBlock, x: 0, y: 0 }, memoryViews });
	};
	const traces = () => vi.mocked(draw.drawFill).mock.calls.filter(call => call[2] === PALETTE_INDICES.onDarkAccent);
	const backgrounds = () => vi.mocked(draw.drawFill).mock.calls.filter(call => call[2] === PALETTE_INDICES.darkSurface);
	const update = (code: string[]) => applyCodeBlockSourceEdits({ store, events }, [{ codeBlock: block, code }]);
	return {
		store,
		state,
		block,
		events,
		draw,
		render,
		traces,
		backgrounds,
		update,
		memoryViews,
		compiled,
		getMemory,
		dispose,
		acceptCompilation,
		replaceMemory: (next: WebAssembly.Memory | null) => {
			currentMemory = next;
			updateMemoryViews(next ?? new ArrayBuffer(0));
		},
	};
}
