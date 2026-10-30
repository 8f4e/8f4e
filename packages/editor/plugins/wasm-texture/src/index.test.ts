import { EventEmitter } from 'node:events';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { resolvePalette } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { createFakeWebGl } from './__tests__/fake-webgl';
import { createWasmTexturePlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

const settings = `; @config wasmTexture.target screen:rgba
; @config wasmTexture.width 1
; @config wasmTexture.height 1
; @config wasmTexture.magnification 32
; @config wasmTexture.position left`;

async function program(pixel = '0x44332211', config = settings, padded = false) {
	const project = parseProjectSource(`8f4e/v1
note config
${config}
noteEnd
entry main
module screen
${padded ? 'int padding 0' : ''}
int rgba 0
push &rgba
push ${pixel}
store
moduleEnd
entryEnd`);
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
	const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as CallableFunction)();
	return { project, compiled, memory };
}

async function setup({ config = settings, hold = false } = {}) {
	let current = await program(undefined, config);
	const initial = current;
	const originalInstantiate = WebAssembly.instantiate;
	const instantiate = vi.spyOn(WebAssembly, 'instantiate');
	let resolvePending!: (source: WebAssembly.WebAssemblyInstantiatedSource) => void;
	const pending = new Promise<WebAssembly.WebAssemblyInstantiatedSource>(resolve => {
		resolvePending = resolve;
	});
	if (hold) instantiate.mockReturnValueOnce(pending as never);
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	Object.assign(state.compiler, current.compiled);
	const drawers = createEditorDrawerRegistry();
	const getMemory = vi.fn(() => current.memory);
	const getCodeBuffer = vi.fn(() => current.compiled.codeBuffer);
	const dispose = createWasmTexturePlugin({ getMemory, getCodeBuffer }).setup({
		store,
		events,
		drawers,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
	});
	events.dispatch('loadProject', { project: current.project });
	const gl = createFakeWebGl();
	Object.assign(gl, { drawingBufferHeight: 180 });
	const layers = drawers.attachRenderLayers({ gl, palette: resolvePalette() });
	const frame = () => {
		const buffer = current.memory.buffer;
		layers.draw({
			state,
			memoryViews: {
				int8: new Int8Array(buffer),
				uint8: new Uint8Array(buffer),
				int16: new Int16Array(buffer),
				uint16: new Uint16Array(buffer),
				int32: new Int32Array(buffer),
				float32: new Float32Array(buffer),
				float64: new Float64Array(buffer),
			},
		});
	};
	const settle = async () => {
		for (const result of instantiate.mock.results) if (result.type === 'return') await result.value;
	};
	cleanups.push(() => {
		dispose();
		layers.destroy();
		store.dispose();
	});
	return {
		gl,
		state,
		events,
		frame,
		settle,
		dispose,
		instantiate,
		getMemory,
		getCodeBuffer,
		get memory() {
			return current.memory;
		},
		address: current.compiled.memoryPlan.modules.screen.memory.rgba.byteAddress,
		release: async () =>
			resolvePending(
				await originalInstantiate(new Uint8Array(initial.compiled.codeBuffer), { host: { memory: initial.memory } })
			),
		recompile: async () => {
			current = await program('0x55443322', config, true);
			events.dispatch('compilationSucceeded', { memoryRef: current.memory });
			Object.assign(state.compiler, current.compiled);
		},
	};
}

it('executes the entry every frame, uploads its pixels, and follows viewport resizing', async () => {
	const test = await setup();
	await test.settle();
	test.frame();
	const data = test.gl.texImage2D.mock.calls.at(-1)!.at(-1) as Uint8Array;
	expect([...data]).toEqual([17, 34, 51, 68]);
	expect(test.gl.uniform4f).toHaveBeenLastCalledWith(expect.anything(), 64, 74, 32, 32);
	const reads = test.getCodeBuffer.mock.calls.length;
	new Uint8Array(test.memory.buffer).fill(0, test.address, test.address + 4);
	Object.assign(test.gl, { drawingBufferWidth: 640, drawingBufferHeight: 360 });
	test.frame();
	expect([...new Uint8Array(test.memory.buffer, test.address, 4)]).toEqual([17, 34, 51, 68]);
	expect(test.gl.texSubImage2D).toHaveBeenCalledOnce();
	expect(test.gl.uniform4f).toHaveBeenLastCalledWith(expect.anything(), 144, 164, 32, 32);
	expect(test.getCodeBuffer).toHaveBeenCalledTimes(reads);
	expect(test.instantiate).toHaveBeenCalledOnce();
});

it('allocates only for complete configuration and releases resources when it is removed', async () => {
	const test = await setup({ config: '; @config wasmTexture.width 1' });
	test.frame();
	expect(test.gl.createProgram).not.toHaveBeenCalled();
	const loaded = await program();
	test.events.dispatch('loadProject', { project: loaded.project });
	await test.settle();
	test.frame();
	expect(test.gl.texImage2D).toHaveBeenCalledOnce();
	test.events.dispatch('loadProject', { project: parseProjectSource('8f4e/v1\nnote empty\nnoteEnd') });
	expect(test.gl.deleteTexture).toHaveBeenCalledOnce();
	expect(test.gl.deleteProgram).toHaveBeenCalledOnce();
});

it('uses replacement compiler memory and updated addresses', async () => {
	const test = await setup();
	await test.settle();
	test.frame();
	await test.recompile();
	await test.settle();
	test.frame();
	const data = test.gl.texSubImage2D.mock.calls.at(-1)!.at(-1) as Uint8Array;
	expect(data.buffer).toBe(test.memory.buffer);
	expect([...data]).toEqual([34, 51, 68, 85]);
});

it('ignores a pending WASM instance after disposal', async () => {
	const test = await setup({ hold: true });
	test.dispose();
	await test.release();
	await test.settle();
	test.frame();
	expect(test.gl.drawArrays).not.toHaveBeenCalled();
	expect(test.gl.deleteProgram).toHaveBeenCalledOnce();
});

it('keeps a replacement compilation when an older instance completes later', async () => {
	const test = await setup({ hold: true });
	await test.recompile();
	await test.instantiate.mock.results.at(-1)!.value;
	test.frame();
	expect([...(test.gl.texImage2D.mock.calls.at(-1)!.at(-1) as Uint8Array)]).toEqual([34, 51, 68, 85]);
	await test.release();
	await test.settle();
	test.frame();
	expect([...(test.gl.texSubImage2D.mock.calls.at(-1)!.at(-1) as Uint8Array)]).toEqual([34, 51, 68, 85]);
});
