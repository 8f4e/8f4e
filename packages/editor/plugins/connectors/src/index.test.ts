import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { resolvePalette } from '@8f4e/editor-palette';
import initState, { deleteCodeBlocks } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { createEditorDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
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

const cleanups: Array<() => void> = [];
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
				drawers,
			})
		: () => {};
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
	cleanups.push(() => {
		layers.destroy();
		dispose();
		store.dispose();
	});
	return { store, state, events, drawers, memoryViews, gl, layers, render, dispose };
}

describe('connectors plugin', () => {
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
		dispose();
		dispose();
		events.dispatch('memoryValuesChanged');
		state.codeBlockRendering.selectedCodeBlock = undefined;
		render();
		expect(gl.drawArraysInstanced).not.toHaveBeenCalled();
		expect(gl.deleteBuffer).toHaveBeenCalledOnce();
	});
});
