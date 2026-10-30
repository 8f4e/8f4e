import { EventEmitter } from 'node:events';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { resolvePalette } from '@8f4e/editor-palette';
import initState, { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { createFakeWebGl } from './__tests__/fake-webgl';
import { createTextureRuntimePlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

const settings = '; @config textureRuntime.enabled true';

async function program(pixel = '0x44332211', config = settings, padded = false, source?: string) {
	const project = parseProjectSource(
		source ??
			`8f4e/v1
note config
${config}
noteEnd
entry main
module screen
; @pos 4 4
; @texture rgba rgba 1 1 32
${padded ? 'int padding 0' : ''}
int rgba 0
int frames 0
push &frames
push frames
push 1
add
store
push &rgba
push ${pixel}
store
moduleEnd
entryEnd`
	);
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
	const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as CallableFunction)();
	return { project, compiled, memory };
}

async function setup({
	config = settings,
	hold = false,
	source,
}: {
	config?: string;
	hold?: boolean;
	source?: string;
} = {}) {
	let current = await program(undefined, config, false, source);
	const screenId = Object.keys(current.compiled.memoryPlan.modules).find(
		id => id === 'screen' || id.endsWith('/screen')
	)!;
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
	Object.assign(state.viewport, { x: 0, y: 0, width: 640, height: 480 });
	const publishMetadata = ({
		compiledFunctions,
		compiledModules,
		projectMemoryExposuresByGroupPath,
		memoryPlan,
		memoryDefaultsByModuleId,
	}: typeof current.compiled) => {
		store.set('compiler', {
			...state.compiler,
			compiledFunctions,
			compiledModules,
			projectMemoryExposuresByGroupPath,
			memoryPlan,
			memoryDefaultsByModuleId,
		});
	};
	publishMetadata(current.compiled);
	const drawers = createEditorDrawerRegistry();
	const dispose = createTextureRuntimePlugin({
		getMemory: () => current.memory,
		getCodeBuffer: () => current.compiled.codeBuffer,
	}).setup({
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
	const block = state.codeBlockRendering.codeBlocks.find(block => block.name === 'screen' || block.name === 'visuals')!;
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
		block,
		events,
		frame,
		settle,
		dispose,
		instantiate,
		get memory() {
			return current.memory;
		},
		frameCount: () =>
			new Int32Array(current.memory.buffer)[
				current.compiled.memoryPlan.modules[screenId].memory.frames.allocationUnitAddress
			],
		editTextures: (directives: string) => {
			const code = block.code.filter(line => !line.includes('@texture'));
			code.splice(2, 0, ...directives.split('\n').filter(Boolean));
			applyCodeBlockSourceEdits(store, [{ codeBlock: block, code }], { affectsCompilation: false });
		},
		editConfig: (source: string) => {
			const block = state.codeBlockRendering.codeBlocks.find(block => block.name === 'config')!;
			applyCodeBlockSourceEdits(
				store,
				[{ codeBlock: block, code: ['note config', ...source.split('\n'), 'noteEnd'] }],
				{ affectsCompilation: false }
			);
		},
		release: async () =>
			resolvePending(
				await originalInstantiate(new Uint8Array(initial.compiled.codeBuffer), { host: { memory: initial.memory } })
			),
		recompile: async () => {
			current = await program('0x55443322', config, true);
			events.dispatch('compilationSucceeded', { memoryRef: current.memory });
			publishMetadata(current.compiled);
		},
	};
}

it('executes once per frame for multiple textures, uploads updated pixels, and follows block movement', async () => {
	const test = await setup();
	await test.settle();
	test.editTextures('; @texture rgba rgba 1 1 32\n; @texture frames mono 1 1 16');
	test.frame();
	expect(test.frameCount()).toBe(1);
	expect(test.gl.createProgram).toHaveBeenCalledOnce();
	expect(test.gl.createTexture).toHaveBeenCalledTimes(2);
	expect([...(test.gl.texImage2D.mock.calls[0].at(-1) as Uint8Array)]).toEqual([17, 34, 51, 68]);
	const rect = test.gl.uniform4f.mock.calls[0];
	test.block.x += 40;
	test.state.viewport.y += 20;
	test.frame();
	expect(test.frameCount()).toBe(2);
	expect(test.gl.uniform4f.mock.calls[2].slice(1)).toEqual([Number(rect[1]) + 40, Number(rect[2]) - 20, 32, 32]);
	expect(test.gl.texSubImage2D).toHaveBeenCalledTimes(2);
	expect(test.instantiate).toHaveBeenCalledOnce();
});

it('reserves rows after each directive and widens the block, even before memory resolves', async () => {
	const test = await setup();
	const initialHeight = test.block.height;
	test.editTextures('; @texture missing rgba 300 20 2\n; @texture rgba mono 1 17 1');
	expect(test.block.width).toBeGreaterThanOrEqual(
		600 + (test.block.lineNumberColumnWidth + 3) * test.state.viewport.vGrid
	);
	expect(test.block.height).toBe(initialHeight + 4 * test.state.viewport.hGrid);
	test.frame();
	expect(test.gl.createTexture).not.toHaveBeenCalled();
	test.editTextures('');
	expect(test.block.minGridWidth).toBeUndefined();
	expect(test.block.height).toBeLessThan(initialHeight);
});

it('displays memory with execution disabled and can enable, disable, and restart the entry', async () => {
	const test = await setup({ config: '' });
	test.frame();
	expect(test.instantiate).not.toHaveBeenCalled();
	expect(test.gl.drawArrays).toHaveBeenCalledOnce();
	expect(test.frameCount()).toBe(0);
	test.editConfig(settings);
	await test.settle();
	test.frame();
	expect(test.frameCount()).toBe(1);
	test.editConfig('; @config textureRuntime.enabled false');
	test.frame();
	expect(test.frameCount()).toBe(1);
	expect(test.gl.drawArrays).toHaveBeenCalledTimes(3);
	test.editConfig(settings);
	await test.settle();
	test.frame();
	expect(test.frameCount()).toBe(2);
	expect(test.instantiate).toHaveBeenCalledTimes(2);
});

it('reuses the current instance for texture edits and releases removed or offscreen views', async () => {
	const test = await setup();
	await test.settle();
	test.frame();
	test.editTextures('; @texture rgba mono 1 1 16');
	test.frame();
	expect(test.instantiate).toHaveBeenCalledOnce();
	expect(test.gl.uniform4f).toHaveBeenLastCalledWith(expect.anything(), expect.any(Number), expect.any(Number), 16, 16);
	test.state.viewport.x = 100000;
	test.frame();
	expect(test.frameCount()).toBe(3);
	expect(test.gl.deleteTexture).toHaveBeenCalledOnce();
	test.state.viewport.x = 0;
	test.frame();
	expect(test.gl.createTexture).toHaveBeenCalledTimes(2);
	test.editTextures('');
	test.frame();
	expect(test.gl.deleteTexture).toHaveBeenCalledTimes(2);
});

it('does not read past the framebuffer declaration', async () => {
	const test = await setup();
	test.editTextures('; @texture rgba rgba 2 1 16');
	test.frame();
	expect(test.gl.drawArrays).not.toHaveBeenCalled();
	test.editTextures('; @texture rgba rgba 1 1 16');
	test.frame();
	expect(test.gl.drawArrays).toHaveBeenCalledOnce();
});

it('keeps a pending instance through texture edits, and applies the current entry', async () => {
	const test = await setup({ hold: true });
	test.editTextures('; @texture rgba rgba 1 1 16');
	test.editConfig(settings + '\n; @config textureRuntime.entry missing');
	await test.release();
	await test.settle();
	test.frame();
	expect(test.frameCount()).toBe(0);
	test.editConfig(settings);
	test.frame();
	expect(test.frameCount()).toBe(1);
	expect(test.instantiate).toHaveBeenCalledOnce();
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

it.each(['disabled', 'disposed'] as const)('discards a pending instance when %s', async mode => {
	const test = await setup({ hold: true });
	if (mode === 'disposed') test.dispose();
	else test.editConfig('; @config textureRuntime.enabled false');
	await test.release();
	await test.settle();
	test.frame();
	expect(test.frameCount()).toBe(0);
	expect(test.gl.drawArrays).toHaveBeenCalledTimes(mode === 'disposed' ? 0 : 1);
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

it('stacks chained texture directives without sharing or overwriting their GPU storage', async () => {
	const test = await setup();
	await test.settle();
	test.editTextures('; @texture rgba rgba 1 1 32 @texture frames mono 1 1 16');
	test.frame();
	expect(test.gl.createTexture).toHaveBeenCalledTimes(2);
	const first = test.gl.uniform4f.mock.calls[0];
	const second = test.gl.uniform4f.mock.calls[1];
	expect(second.slice(1)).toEqual([first[1], Number(first[2]) + 32, 16, 16]);
	expect(test.frameCount()).toBe(1);
});

it('hides texture views and their reserved space when source is collapsed', async () => {
	const test = await setup();
	test.editTextures('; @hide\n; @texture rgba rgba 1 1 32');
	test.events.dispatch('exitToViewMode');
	expect(test.block.isCollapsed).toBe(true);
	expect(test.block.minGridWidth).toBeUndefined();
	test.frame();
	expect(test.gl.createTexture).not.toHaveBeenCalled();
});

it('resolves group exposures locally and from a qualified reference on a note', async () => {
	const test = await setup({
		config: '',
		source: `8f4e/v1
note viewer
; @pos 4 4
; @texture visuals:picture rgba 1 1 16
noteEnd
entry main
group visuals
; @pos 4 12
expose picture &screen:rgba
; @texture picture rgba 1 1 16
module screen
int rgba 0x44332211
moduleEnd
groupEnd
entryEnd`,
	});
	test.frame();
	expect(test.gl.createTexture).toHaveBeenCalledTimes(2);
	for (const call of test.gl.texImage2D.mock.calls) expect([...(call.at(-1) as Uint8Array)]).toEqual([17, 34, 51, 68]);
});
