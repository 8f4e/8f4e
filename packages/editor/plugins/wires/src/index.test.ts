import { EventEmitter } from 'node:events';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { resolvePalette } from '@8f4e/editor-palette';
import initState, { setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import { createEditorDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeWebGl } from './__tests__/fake-webgl';
import { createRenderGeometryFixture } from './__tests__/render-geometry-fixture';
import { wiresPlugin } from './index';

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

async function setup(text = source, installed = true) {
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
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	const drawers = createEditorDrawerRegistry();
	const dispose = installed
		? wiresPlugin.setup({
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
	events.dispatch('loadProject', { project });
	store.set('compiler.result', { ...compiled, inputRevision: state.compilerInputRevision });
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
	it('hides wires during dialogs and highlights connections for the selected input block', async () => {
		const { state, gl, render } = await setup();
		state.dialogStack.push({ id: 'test', title: 'Test', text: '', buttons: [] });
		render();
		expect(gl.drawArraysInstanced).not.toHaveBeenCalled();
		state.dialogStack = [];
		state.project.selectedCodeBlock = state.project.activeLevel.blocks.find(block => block.name === 'sink');
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
		events.dispatch('gridSizeChanged');
		state.project.selectedCodeBlock = undefined;
		render();
		expect(gl.drawArraysInstanced).not.toHaveBeenCalled();
		expect(gl.deleteBuffer).toHaveBeenCalledOnce();
	});
});
