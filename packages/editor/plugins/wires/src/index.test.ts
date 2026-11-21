import { EventEmitter } from 'node:events';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { resolvePalette } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import { createEditorDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeWebGl } from './__tests__/fake-webgl';
import { createRenderGeometryFixture } from './__tests__/render-geometry-fixture';
import { looseWiresPlugin, wiresPlugin } from './index';
import { LINE_INSTANCE_BYTE_STRIDE } from './line-drawer/line-instance';

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
function runCleanup(cleanup: () => void) {
	cleanups.splice(cleanups.indexOf(cleanup), 1);
	cleanup();
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

async function setup(text = source, installed = true, plugin = wiresPlugin) {
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
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: { getWordFromMemory: address => memoryViews.int32[address] } });
	const drawers = createEditorDrawerRegistry();
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
		layers.draw({ state, memoryViews, renderGeometry: createRenderGeometryFixture(state) });
	};
	cleanups.push(store.dispose);
	if (dispose) cleanups.push(dispose);
	cleanups.push(() => layers.destroy());
	return { store, state, events, drawers, memoryViews, gl, layers, render, dispose };
}

describe('wires plugin', () => {
	it('batches loose wires between the same connector positions as straight wires', async () => {
		const sample = async (plugin: typeof wiresPlugin) => {
			const { gl, render } = await setup(source, true, plugin);
			render();
			expect(gl.drawArraysInstanced).toHaveBeenCalledOnce();
			const [, , bytes, , usedLength] = gl.bufferSubData.mock.calls.at(-1)!;
			const buffer = bytes as Uint8Array;
			const view = new DataView(buffer.buffer, buffer.byteOffset);
			return Array.from({ length: Number(usedLength) / LINE_INSTANCE_BYTE_STRIDE }, (_, segment) => {
				const offset = segment * LINE_INSTANCE_BYTE_STRIDE;
				return [0, 4, 8, 12].map(field => view.getFloat32(offset + field, true));
			});
		};
		const [straight] = await sample(wiresPlugin);
		const loose = await sample(looseWiresPlugin);
		expect(loose.length).toBeGreaterThan(1);
		expect(loose[0].slice(0, 2)).toEqual(straight.slice(0, 2));
		expect(loose.at(-1)?.slice(2)).toEqual(straight.slice(2));
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

	it('can install after the project and renderer are already initialized', async () => {
		const { store, events, drawers, gl, render } = await setup(source, false);
		const disposeWires = wiresPlugin.setup({
			store,
			events,
			drawers,
			layout: store.layout,
			loading: store.loading,
			menus: store.menus,
			directives: store.directives,
		});
		cleanups.push(disposeWires);
		render();
		expect(gl.drawArraysInstanced).toHaveBeenCalledOnce();
		runCleanup(disposeWires);
		render();
		expect(gl.drawArraysInstanced).not.toHaveBeenCalled();
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
