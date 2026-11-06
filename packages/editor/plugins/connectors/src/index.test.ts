import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { resolvePalette } from '@8f4e/editor-palette';
import initState, { applyCodeBlockSourceEdits, deleteCodeBlocks, serializeProjectLevel } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { createFakeWebGl } from './__tests__/fake-webgl';
import { connectorsPlugin } from './index';
import { LineDrawer } from './line-drawer';

const source = `8f4e/v1
entry main
module source
; @pos 50 1
float output 1
moduleEnd
module sink
; @pos 2 1
float* input &source:output
moduleEnd
entryEnd`;

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

async function setup(text = source, installed = true) {
	const project = parseProjectSource(text);
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
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
	const gl = createFakeWebGl();
	const layers = drawers.attachRenderLayers({ gl, palette: resolvePalette({}) });
	const render = () => {
		gl.drawArraysInstanced.mockClear();
		layers.draw({ state, memoryViews });
	};
	const drawText = vi.fn();
	const drawLabels = (codeBlock: CodeBlockGraphicData) => {
		drawText.mockClear();
		drawers.drawCodeBlock({
			draw: { drawText, drawFill: vi.fn(), drawCharacter: vi.fn() } as unknown as DrawContext,
			state,
			codeBlock,
			memoryViews,
		});
		return drawText.mock.calls.map(([x, y, text]) => ({ x, y, text }));
	};
	cleanups.push(store.dispose);
	if (dispose) cleanups.push(dispose);
	cleanups.push(() => layers.destroy());
	return { store, state, events, drawers, memoryViews, gl, layers, render, dispose, drawLabels };
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

	it('keeps inherited labels and wire endpoints aligned with contributed rows', async () => {
		const drawLine = vi.spyOn(LineDrawer.prototype, 'drawLine');
		const test = await setup(shapeSource);
		const sink = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sink')!;
		const memory = test.state.compiler.result.memoryPlan.modules;
		test.memoryViews.int32[memory.sink.memory.input.allocationUnitAddress] = memory.source.memory.output.byteAddress;
		const contribution = test.store.layout.createContribution();
		cleanups.push(contribution.dispose);
		contribution.update(sink, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 2 }] });
		expect(sink.gaps.get(2)?.size).toBe(2);
		expect(test.drawLabels(sink)).toEqual([
			{ x: 24, y: 80, text: 'int* input' },
			{ x: 24, y: 96, text: 'int output' },
		]);
		test.render();
		expect(drawLine.mock.calls[0][1]).toBe(sink.y + 88 - test.state.viewport.y);
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
			const result = await compileProject(serializeProjectLevel(test.state.codeBlockRendering.rootProject), {
				disableSharedMemory: true,
			});
			test.store.set('compiler.result', {
				compiledModules: result.compiledModules,
				compiledFunctions: result.compiledFunctions,
				memoryPlan: result.memoryPlan,
				memoryDefaultsByModuleId: result.memoryDefaultsByModuleId,
				projectMemoryExposuresByGroupPath: result.projectMemoryExposuresByGroupPath,
			});
			test.store.set('compiler.isCompiling', false);
		};
		applyCodeBlockSourceEdits(
			test,
			[{ codeBlock: prototype, code: prototype.code.map(line => (line === 'int output' ? 'float output' : line)) }],
			{ affectsCompilation: true }
		);
		await recompile();
		expect(test.drawLabels(func).map(label => label.text)).toEqual(['int** input', 'float* output']);
		applyCodeBlockSourceEdits(
			test,
			[{ codeBlock: func, code: func.code.filter(line => !line.startsWith('paramShape')) }],
			{ affectsCompilation: true }
		);
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
				applyCodeBlockSourceEdits(test, [{ codeBlock: block, code: [code[0], directive, ...code.slice(1)] }], {
					affectsCompilation: true,
				});
				expect(test.drawLabels(block)).toEqual([]);
				expect(block.gaps.size).toBe(0);
			}
		}
	});

	it('allocates no connector GPU resources when omitted', async () => {
		const { gl, render } = await setup(source, false);
		render();
		expect(gl.createBuffer).not.toHaveBeenCalled();
		expect(gl.createProgram).not.toHaveBeenCalled();
	});

	it('draws live pointer connections independently of block visibility', async () => {
		const { state, memoryViews, gl, render } = await setup();
		const output = state.compiler.result.memoryPlan.modules.source.memory.output;
		const input = state.compiler.result.memoryPlan.modules.sink.memory.input;
		state.codeBlockRendering.currentProject.blocks[0].x = -10000;
		state.codeBlockRendering.currentProject.blocks[1].x = 10000;
		render();
		expect(gl.drawArraysInstanced).toHaveBeenCalledWith(gl.TRIANGLE_STRIP, 0, 4, 1);
		memoryViews.int32[input.allocationUnitAddress] = 123456;
		render();
		expect(gl.drawArraysInstanced).not.toHaveBeenCalled();
		memoryViews.int32[input.allocationUnitAddress] = output.byteAddress;
		render();
		expect(gl.drawArraysInstanced).toHaveBeenCalledOnce();
	});

	it('hides wires during dialogs and highlights connections for the selected input block', async () => {
		const { state, gl, render } = await setup();
		state.dialogStack.push({ id: 'test', title: 'Test', text: '', buttons: [] });
		render();
		expect(gl.drawArraysInstanced).not.toHaveBeenCalled();
		state.dialogStack = [];
		state.codeBlockRendering.selectedCodeBlock = state.codeBlockRendering.currentProject.blocks.find(
			block => block.name === 'sink'
		);
		render();
		const bytes = gl.bufferSubData.mock.calls.at(-1)![2] as Uint8Array;
		expect(new DataView(bytes.buffer, bytes.byteOffset).getFloat32(16, true)).toBe(2);
	});

	it.each(['root', 'group'])(
		'keeps wires on the active same-named output after selection changes in a %s',
		async scope => {
			const body = `module source
; @pos 20 2
float output 1
moduleEnd
module source
; @pos 60 2
float output 2
moduleEnd
module sink
; @pos 2 20
float* input &source:output
moduleEnd`;
			const text =
				scope === 'group'
					? `8f4e/v1\nentry main\ngroup voice\nentry main\n${body}\nentryEnd\ngroupEnd\nentryEnd`
					: `8f4e/v1\nentry main\n${body}\nentryEnd`;
			const drawLine = vi.spyOn(LineDrawer.prototype, 'drawLine');
			const { state, events, memoryViews, render } = await setup(text);
			if (scope === 'group') {
				events.dispatch('openProjectGroup', {
					codeBlock: state.codeBlockRendering.rootProject.blocks.find(block => block.childProject),
				});
			}
			events.dispatch('enterEditMode');
			const sources = state.codeBlockRendering.currentProject.blocks.filter(block => block.name === 'source');
			const [inactive, active] = sources;
			const sink = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sink')!;
			const moduleId = scope === 'group' ? 'voice/source' : 'source';
			expect(state.compiler.result.compiledModules[moduleId].ast.projectBlockId).toBe(active.creationIndex);
			const onInputChanged = vi.fn();
			events.on('compilationInputChanged', onInputChanged);
			const expectActiveWire = () => {
				drawLine.mockClear();
				render();
				expect(drawLine).toHaveBeenCalledOnce();
				expect(drawLine.mock.calls[0][2]).toBe(
					active.x + Math.round(active.width - state.viewport.vGrid * 1.5) - state.viewport.x
				);
			};
			expectActiveWire();
			for (const block of [inactive, active, sink, inactive, active]) {
				events.dispatch('pointerdown', {
					x: block.x - state.viewport.x + 1,
					y: block.y - state.viewport.y + 1,
					movementX: 0,
					movementY: 0,
					buttons: 1,
					stopPropagation: false,
					canvasWidth: 800,
					canvasHeight: 600,
					altKey: false,
				});
				events.dispatch('pointerup');
				expectActiveWire();
			}
			expect(onInputChanged).not.toHaveBeenCalled();
			const output = state.compiler.result.memoryPlan.modules[moduleId].memory.output;
			expect(memoryViews.float32[output.allocationUnitAddress]).toBe(2);
		}
	);

	it('draws inputs only for the active same-named module', async () => {
		const drawLine = vi.spyOn(LineDrawer.prototype, 'drawLine');
		const { state, render } = await setup(`8f4e/v1
entry main
module source
; @pos 60 2
float output 2
moduleEnd
module sink
; @pos 2 2
float* input &source:output
moduleEnd
module sink
; @pos 2 20
float* input &source:output
moduleEnd
entryEnd`);
		const active = state.codeBlockRendering.currentProject.blocks.find(
			block => block.creationIndex === state.compiler.result.compiledModules.sink.ast.projectBlockId
		)!;
		render();
		expect(drawLine).toHaveBeenCalledOnce();
		expect(drawLine.mock.calls[0][0]).toBe(active.x + Math.round(state.viewport.vGrid * 1.5) - state.viewport.x);
	});

	it('removes obsolete outputs when blocks are deleted or the project is replaced', async () => {
		const { state, store, events, gl, render } = await setup();
		render();
		expect(gl.drawArraysInstanced).toHaveBeenCalledOnce();
		deleteCodeBlocks(store, [state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'source')!]);
		render();
		expect(gl.drawArraysInstanced).not.toHaveBeenCalled();
		events.dispatch('loadProject', { project: parseProjectSource(source) });
		render();
		expect(gl.drawArraysInstanced).toHaveBeenCalledOnce();
		events.dispatch('loadProject', { project: parseProjectSource('8f4e/v1\nentry main\nentryEnd') });
		render();
		expect(gl.drawArraysInstanced).not.toHaveBeenCalled();
	});

	it('rebinds geometry and the output index when compilation changes memory addresses', async () => {
		const { state, events, memoryViews, gl, render } = await setup();
		const module = state.compiler.result.memoryPlan.modules.source;
		module.memory.output = { ...module.memory.output, byteAddress: 128, allocationUnitAddress: 32 };
		memoryViews.int32[state.compiler.result.memoryPlan.modules.sink.memory.input.allocationUnitAddress] = 128;
		events.dispatch('memoryValuesChanged');
		render();
		expect(gl.drawArraysInstanced).toHaveBeenCalledOnce();
	});

	it('resolves group exposures and rebuilds the index while navigating between project slices', async () => {
		const drawLine = vi.spyOn(LineDrawer.prototype, 'drawLine');
		const { state, store, render } = await setup(`8f4e/v1
entry main
group patch
expose output &source:value
entry main
module source
float value 1
moduleEnd
module innerSink
float* input &source:value
moduleEnd
entryEnd
groupEnd
module outerSink
float* input &patch:output
moduleEnd
entryEnd`);
		const root = state.codeBlockRendering.currentProject.blocks;
		const group = root.find(block => block.name === 'patch')!;
		const outerSink = root.find(block => block.name === 'outerSink')!;
		const nested = group.childProject!.blocks;
		const innerSink = nested.find(block => block.name === 'innerSink')!;
		const innerSource = nested.find(block => block.name === 'source')!;
		const expectConnection = (input: CodeBlockGraphicData, output: CodeBlockGraphicData) => {
			drawLine.mockClear();
			render();
			// Each fixture declaration is on its block's second source row.
			const { vGrid, hGrid, x, y } = state.viewport;
			expect(drawLine.mock.calls.map(call => call.slice(0, 4))).toEqual([
				[
					input.x + vGrid * 1.5 - x,
					input.y + hGrid * 1.5 - y,
					output.x + output.width - vGrid * 1.5 - x,
					output.y + hGrid * 1.5 - y,
				],
			]);
		};
		expectConnection(outerSink, group);
		store.set('codeBlockRendering.currentProject.blocks', nested);
		expectConnection(innerSink, innerSource);
		store.set('codeBlockRendering.currentProject.blocks', root);
		expectConnection(outerSink, group);
	});

	it('can install after the project and renderer are already initialized', async () => {
		const { store, events, drawers, gl, render } = await setup(source, false);
		const dispose = connectorsPlugin.setup({
			store,
			events,
			menus: store.menus,
			directives: store.directives,
			layout: store.layout,
			loading: store.loading,
			drawers,
		});
		cleanups.push(dispose);
		render();
		expect(gl.drawArraysInstanced).toHaveBeenCalledOnce();
	});

	it('owns palette changes, GPU memory release, and disposal', async () => {
		const { state, events, gl, layers, render, dispose } = await setup();
		const palette = resolvePalette({ stroke: '#ff0000' });
		layers.loadPalette(palette);
		render();
		const bytes = gl.bufferSubData.mock.calls.at(-1)![2] as Uint8Array;
		expect([...bytes.slice(20, 24)]).toEqual(palette.rgba.strokeBase.map(component => Math.round(component * 255)));
		layers.releaseMemory();
		const uploads = gl.bufferData.mock.calls.length;
		render();
		expect(gl.bufferData).toHaveBeenCalledTimes(uploads + 1);
		runCleanup(dispose!);
		events.dispatch('memoryValuesChanged');
		state.codeBlockRendering.selectedCodeBlock = undefined;
		render();
		expect(gl.drawArraysInstanced).not.toHaveBeenCalled();
		expect(gl.deleteBuffer).toHaveBeenCalledOnce();
	});
});
