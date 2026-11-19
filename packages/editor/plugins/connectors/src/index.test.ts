import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState, { applyCodeBlockSourceEdits, serializeProjectLevel } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import initWebUi, { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { AsciiRenderer } from '@8f4e/web-ui-testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { connectorsPlugin } from './index';

const shapeSource = `8f4e/v1
prototype voiceState
; @pos 100 100
int* input
int output
prototypeEnd
function process
; @pos 45 12
paramShape voiceState
functionEnd
entry main
module source
; @pos 50 1
int output 1
moduleEnd
module sink
; @pos 2 1
shape voiceState
moduleEnd
entryEnd`;

const cleanups: Array<() => void> = [];
function runCleanup(cleanup: () => void) {
	cleanups.splice(cleanups.indexOf(cleanup), 1);
	cleanup();
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

async function setup(text = shapeSource, installed = true) {
	const project = parseProjectSource(text);
	const compiled = await compileProject(project);
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
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
	const store = initState(events, { callbacks: { getWordFromMemory: address => memoryViews.int32[address] } });
	const drawers = createEditorDrawerRegistry();
	const registerRenderLayer = vi.spyOn(drawers, 'registerRenderLayer');
	const dispose = installed
		? connectorsPlugin.setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				loading: store.loading,
				drawers,
			})
		: undefined;
	const state = store.getState();
	Object.assign(state.compiler.result, {
		memoryPlan: compiled.memoryPlan,
		memoryDefaultsByModuleId: compiled.memoryDefaultsByModuleId,
		compiledModules: compiled.compiledModules,
		compiledFunctions: compiled.compiledFunctions,
		projectMemoryExposuresByGroupPath: compiled.projectMemoryExposuresByGroupPath,
	});
	events.dispatch('loadProject', { project });
	const drawGlyphs = vi.fn();
	const drawLabels = (codeBlock: CodeBlockGraphicData) => {
		drawGlyphs.mockClear();
		drawers.drawCodeBlock({
			draw: { drawGlyphs, drawFill: vi.fn(), drawSprite: vi.fn() } as unknown as DrawContext,
			state,
			codeBlock,
			memoryViews,
		});
		return drawGlyphs.mock.calls.map(([x, y, glyphs]) => ({ x, y, text: String.fromCharCode(...glyphs) }));
	};
	cleanups.push(store.dispose);
	if (dispose) cleanups.push(dispose);
	return { store, state, events, drawers, memoryViews, registerRenderLayer, drawLabels };
}

describe('connectors plugin', () => {
	it('targets active module definitions and individual function overloads by source identity', async () => {
		const test = await setup(
			shapeSource
				.replace('entry main', 'function process\nparam float left\nparam float right\nfunctionEnd\nentry main')
				.replace('entryEnd', 'module sink\nshape voiceState\nmoduleEnd\nentryEnd')
		);
		const blocks = test.state.codeBlockRendering.currentProject.blocks;
		const sinks = blocks.filter(block => block.name === 'sink');
		expect(test.drawLabels(sinks[0])).toEqual([]);
		expect(sinks[0].gaps.size).toBe(0);
		expect(test.drawLabels(sinks[1]).map(label => label.text)).toEqual(['int* input', 'int output']);
		const functions = blocks.filter(block => block.name === 'process');
		expect(test.drawLabels(functions[0]).map(label => label.text)).toEqual(['int** input', 'int* output']);
		expect(test.drawLabels(functions[1])).toEqual([]);
		expect(functions[1].gaps.size).toBe(0);
	});

	it('owns module and function expansion space, including late installation and disposal', async () => {
		const test = await setup(shapeSource, false);
		const blocks = test.state.codeBlockRendering.currentProject.blocks;
		const sink = blocks.find(block => block.name === 'sink')!;
		const func = blocks.find(block => block.name === 'process')!;
		expect(sink.gaps.size).toBe(0);
		expect(func.gaps.size).toBe(0);
		const dispose = connectorsPlugin.setup({
			store: test.store,
			events: test.events,
			drawers: test.drawers,
			layout: test.store.layout,
			loading: test.store.loading,
			menus: test.store.menus,
			directives: test.store.directives,
		});
		cleanups.push(dispose);
		expect(sink.gaps.get(2)?.size).toBe(2);
		expect(func.gaps.get(2)?.size).toBe(2);
		expect(test.drawLabels(func)).toEqual([
			{ x: 24, y: 48, text: 'int** input' },
			{ x: 24, y: 64, text: 'int* output' },
		]);
		runCleanup(dispose);
		expect(test.drawLabels(sink)).toEqual([]);
		expect(test.drawLabels(func)).toEqual([]);
		expect(sink.gaps.size).toBe(0);
		expect(func.gaps.size).toBe(0);
	});

	it('refreshes and removes function expansion labels after source edits and recompilation', async () => {
		const test = await setup(shapeSource);
		const blocks = test.state.codeBlockRendering.currentProject.blocks;
		const prototype = blocks.find(block => block.name === 'voiceState')!;
		const func = blocks.find(block => block.name === 'process')!;
		const recompile = async () => {
			test.store.set('compiler.isCompiling', true);
			const result = await compileProject(serializeProjectLevel(test.state.codeBlockRendering.rootProject));
			test.store.set('compiler.result', {
				...test.state.compiler.result,
				compiledModules: result.compiledModules,
				compiledFunctions: result.compiledFunctions,
				memoryPlan: result.memoryPlan,
				memoryDefaultsByModuleId: result.memoryDefaultsByModuleId,
				projectMemoryExposuresByGroupPath: result.projectMemoryExposuresByGroupPath,
			});
			test.store.set('compiler.isCompiling', false);
		};
		applyCodeBlockSourceEdits(test, [
			{ codeBlock: prototype, code: prototype.code.map(line => (line === 'int output' ? 'float output' : line)) },
		]);
		await recompile();
		expect(test.drawLabels(func).map(label => label.text)).toEqual(['int** input', 'float* output']);
		applyCodeBlockSourceEdits(test, [
			{ codeBlock: func, code: func.code.filter(line => !line.startsWith('paramShape')) },
		]);
		await recompile();
		expect(test.drawLabels(func)).toEqual([]);
		expect(func.gaps.size).toBe(0);
	});

	it('reserves and draws no expansion rows for disabled or hidden source', async () => {
		const test = await setup(shapeSource);
		const blocks = test.state.codeBlockRendering.currentProject.blocks;
		for (const name of ['sink', 'process']) {
			const block = blocks.find(block => block.name === name)!;
			const code = [...block.code];
			for (const directive of ['; @disabled', '; @hide']) {
				applyCodeBlockSourceEdits(test, [{ codeBlock: block, code: [code[0], directive, ...code.slice(1)] }]);
				expect(test.drawLabels(block)).toEqual([]);
				expect(block.gaps.size).toBe(0);
			}
		}
	});

	it('renders connector sprites and labels without registering a GPU wire pass', async () => {
		const { store, events, drawers, memoryViews, registerRenderLayer } = await setup();
		const width = 800;
		const height = 320;
		store.set('viewport.width', width);
		store.set('viewport.height', height);
		const ascii = new AsciiRenderer(width, height);
		const view = await initWebUi(store, events, ascii, memoryViews, { drawers, loading: store.loading });
		cleanups.push(view.destroy);
		view.renderFrame();
		const frame = ascii.toText();
		expect(frame).toContain('int* input');
		expect(frame).toContain('[ ]');
		expect(frame).toContain('[*]');
		expect(registerRenderLayer).not.toHaveBeenCalled();
	});
});
