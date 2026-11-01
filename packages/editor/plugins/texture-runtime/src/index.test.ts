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
; @textureUpload &rgba rgba 1 1\n; @texture &rgba 32 1 1
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
	deferMetadata = false,
	source,
}: {
	config?: string;
	hold?: boolean;
	deferMetadata?: boolean;
	source?: string;
} = {}) {
	let current = await program(undefined, config, false, source);
	let hasCompilerMemory = !deferMetadata;
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
		hasCompilerMemory = true;
		store.set('compiler.isCompiling', true);
		store.set('compiler.result', {
			compiledFunctions,
			compiledModules,
			projectMemoryExposuresByGroupPath,
			memoryPlan,
			memoryDefaultsByModuleId,
		});
		store.set('compiler.isCompiling', false);
	};
	if (!deferMetadata) publishMetadata(current.compiled);
	const drawers = createEditorDrawerRegistry();
	const dispose = createTextureRuntimePlugin({
		getMemory: () => (hasCompilerMemory ? current.memory : null),
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
	const block = state.codeBlockRendering.currentProject.blocks.find(
		block => block.name === 'screen' || block.name === 'visuals'
	)!;
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
		store,
		publishMetadata: () => publishMetadata(current.compiled),
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
			const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'config')!;
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
	test.editTextures(
		'; @textureUpload &rgba rgba 1 1\n; @texture &rgba 32 1 1\n; @textureUpload &frames mono 1 1\n; @texture &frames 16 1 1'
	);
	test.frame();
	expect(test.frameCount()).toBe(1);
	expect(test.gl.createProgram).toHaveBeenCalledOnce();
	expect(test.gl.createTexture).toHaveBeenCalledTimes(2);
	expect([...(test.gl.texImage2D.mock.calls[0].at(-1) as Uint8Array)]).toEqual([17, 34, 51, 68]);
	const rect = test.gl.uniform4f.mock.calls.filter(call => (call[0] as { name: string }).name === 'u_rectangle')[0];
	test.block.x += 40;
	test.state.viewport.y += 20;
	test.frame();
	expect(test.frameCount()).toBe(2);
	expect(
		test.gl.uniform4f.mock.calls.filter(call => (call[0] as { name: string }).name === 'u_rectangle')[2].slice(1)
	).toEqual([Number(rect[1]) + 40, Number(rect[2]) - 20, 32, 32]);
	expect(test.gl.texSubImage2D).toHaveBeenCalledTimes(2);
	expect(test.instantiate).toHaveBeenCalledOnce();
});

it('reserves declared view space before compiler memory exists', async () => {
	const test = await setup({ deferMetadata: true });
	test.editTextures('');
	const sourceHeight = test.block.height;
	test.editTextures(
		'; @textureUpload &missing rgba 300 20\n; @texture &missing 2 300 20\n; @textureUpload &other mono 1 17\n; @texture &other 1 1 17'
	);
	expect(test.block.width).toBeGreaterThanOrEqual(
		600 + (test.block.lineNumberColumnWidth + 3) * test.state.viewport.vGrid
	);
	expect(test.block.height).toBe(sourceHeight + 9 * test.state.viewport.hGrid);
	test.frame();
	expect(test.gl.createTexture).not.toHaveBeenCalled();
	test.editTextures('');
	expect(test.block.minGridWidth).toBeUndefined();
	expect(test.block.height).toBe(sourceHeight);
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
	test.editTextures('; @textureUpload &rgba mono 1 1\n; @texture &rgba 16 1 1');
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

it('bounds uploads against current WASM memory', async () => {
	const test = await setup();
	test.editTextures('; @textureUpload &rgba rgba 65536 1\n; @texture &rgba 1 1 1');
	test.frame();
	expect(test.gl.drawArrays).not.toHaveBeenCalled();
	test.editTextures('; @textureUpload &rgba rgba 1 1\n; @texture &rgba 16 1 1');
	test.frame();
	expect(test.gl.drawArrays).toHaveBeenCalledOnce();
});

it('keeps a pending instance through texture edits, and applies the current entry', async () => {
	const test = await setup({ hold: true });
	test.editTextures('; @textureUpload &rgba rgba 1 1\n; @texture &rgba 16 1 1');
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
	const data = test.gl.texImage2D.mock.calls.at(-1)!.at(-1) as Uint8Array;
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
	test.editTextures(
		'; @textureUpload &rgba rgba 1 1 @texture &rgba 32 1 1 @textureUpload &frames mono 1 1 @texture &frames 16 1 1'
	);
	test.frame();
	expect(test.gl.createTexture).toHaveBeenCalledTimes(2);
	const first = test.gl.uniform4f.mock.calls.filter(call => (call[0] as { name: string }).name === 'u_rectangle')[0];
	const second = test.gl.uniform4f.mock.calls.filter(call => (call[0] as { name: string }).name === 'u_rectangle')[1];
	expect(second.slice(1)).toEqual([first[1], Number(first[2]) + 32, 16, 16]);
	expect(test.frameCount()).toBe(1);
});

it('hides texture views and their reserved space when source is collapsed', async () => {
	const test = await setup();
	test.editTextures('; @hide\n; @textureUpload &rgba rgba 1 1\n; @texture &rgba 32 1 1');
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
; @textureUpload &visuals:picture rgba 1 1\n; @texture &visuals:picture 16 1 1
noteEnd
entry main
group visuals
; @pos 4 12
expose picture &screen:rgba
; @textureUpload &picture rgba 1 1\n; @texture &picture 16 1 1
module screen
int rgba 0x44332211
moduleEnd
groupEnd
entryEnd`,
	});
	test.frame();
	expect(test.gl.createTexture).toHaveBeenCalledOnce();
	for (const call of test.gl.texImage2D.mock.calls) expect([...(call.at(-1) as Uint8Array)]).toEqual([17, 34, 51, 68]);
});

it('shares one upload across direct and pointer views, crops, and duplicate declarations', async () => {
	const test = await setup({
		config: '',
		source: `8f4e/v1
entry main
module screen
; @pos 4 4
int8u[] pixels 16 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16
int8u* pointer &pixels
; @textureUpload &pixels rgba 2 2
; @textureUpload pointer rgba 2 2
; @texture &pixels 8 2 2
; @texture pointer 16 1 1 1 1
moduleEnd
entryEnd`,
	});
	test.frame();
	expect(test.gl.createTexture).toHaveBeenCalledOnce();
	expect(test.gl.texImage2D).toHaveBeenCalledOnce();
	expect(test.gl.drawArrays).toHaveBeenCalledTimes(2);
	const sourceRects = test.gl.uniform4f.mock.calls.filter(
		call => (call[0] as { name: string }).name === 'u_sourceRectangle'
	);
	expect(sourceRects.map(call => call.slice(1))).toEqual([
		[0, 0, 2, 2],
		[1, 1, 1, 1],
	]);
	test.frame();
	expect(test.gl.texSubImage2D).toHaveBeenCalledOnce();
});

it('resolves pointers after entry execution and follows double buffering', async () => {
	const test = await setup({
		source: `8f4e/v1
note config
${settings}
noteEnd
entry main
module screen
; @pos 4 4
int first 0x44332211
int second 0x88776655
int8u* pointer &first
int frames 0
; @textureUpload pointer rgba 1 1
; @texture pointer 16 1 1
push &pointer
push &second
store
moduleEnd
entryEnd`,
	});
	await test.settle();
	test.frame();
	expect([...(test.gl.texImage2D.mock.calls[0].at(-1) as Uint8Array)]).toEqual([85, 102, 119, 136]);
	// A view may use a different pointer symbol as long as its current address matches.
	test.editTextures('; @textureUpload &second rgba 1 1\n; @texture pointer 16 1 1');
	test.frame();
	expect(test.gl.texSubImage2D).toHaveBeenCalledOnce();
});

it('rejects conflicting uploads at an address and recovers after the conflict is removed', async () => {
	const test = await setup({ config: '' });
	test.editTextures('; @textureUpload &rgba rgba 1 1\n; @textureUpload &rgba mono 1 1\n; @texture &rgba 16 1 1');
	test.frame();
	test.frame();
	expect(test.gl.drawArrays).not.toHaveBeenCalled();
	expect(test.state.console.logs.filter(log => log.message.includes('Conflicting @textureUpload'))).toHaveLength(1);
	test.editTextures('; @textureUpload &rgba rgba 1 1\n; @texture &rgba 16 1 1');
	test.frame();
	expect(test.gl.drawArrays).toHaveBeenCalledOnce();
});

it('uses uploads from unopened groups for views in the enclosing project', async () => {
	const test = await setup({
		config: '',
		source: `8f4e/v1
note viewer
; @pos 4 4
; @texture &visuals:picture 16 1 1
noteEnd
entry main
group visuals
expose picture &screen:rgba
module screen
int rgba 0x44332211
; @textureUpload &rgba rgba 1 1
moduleEnd
groupEnd
entryEnd`,
	});
	test.frame();
	expect(test.gl.texImage2D).toHaveBeenCalledOnce();
	expect(test.gl.drawArrays).toHaveBeenCalledOnce();
});

it('omits views without an upload or with out-of-bounds crops', async () => {
	const test = await setup({ config: '' });
	test.editTextures('; @textureUpload &rgba rgba 1 1\n; @texture &rgba 16 1 1 1 0\n; @texture &frames 16 1 1');
	test.frame();
	expect(test.gl.createTexture).not.toHaveBeenCalled();
});

it('reserves pointer view geometry before compilation and binds it on completion', async () => {
	const test = await setup({
		config: '',
		deferMetadata: true,
		source: `8f4e/v1
entry main
module screen
int8u[] rgba 4
; @textureUpload &rgba rgba 1 1
moduleEnd
module viewer
; @pos 4 4
int8u* pixels &screen:rgba
; @texture pixels 16 1 1
moduleEnd
entryEnd`,
	});
	const block = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'viewer')!;
	expect(block.gaps.get(3)?.size).toBe(1);
	const height = block.height;
	test.frame();
	expect(test.gl.drawArrays).not.toHaveBeenCalled();
	test.publishMetadata();
	test.frame();
	expect(block.height).toBe(height);
	expect(test.gl.drawArrays).toHaveBeenCalledOnce();
});

it('keeps view layout fixed when a pointer selects differently sized uploads', async () => {
	const test = await setup({
		config: '',
		source: `8f4e/v1
entry main
module screen
; @pos 4 4
int8u[] first 8
int8u[] second 8
int8u* pixels &first
; @textureUpload &first mono 2 4
; @textureUpload &second rgba 2 1
; @texture pixels 8 2 4
; @texture pixels 8 2 1
moduleEnd
entryEnd`,
	});
	test.frame();
	const originalHeight = test.block.height;
	const originalWidth = test.block.width;
	const layoutChanged = vi.fn();
	test.events.on('codeBlockLayoutsChanged', layoutChanged);
	const memory = test.state.compiler.result.memoryPlan.modules.screen.memory;
	new Int32Array(test.memory.buffer)[memory.pixels.allocationUnitAddress] = memory.second.byteAddress;
	test.frame();
	expect(test.block.height).toBe(originalHeight);
	expect(test.block.width).toBe(originalWidth);
	expect(layoutChanged).not.toHaveBeenCalled();
	expect(test.gl.drawArrays).toHaveBeenCalledTimes(3);
	expect(test.gl.uniform4f).toHaveBeenLastCalledWith(expect.anything(), expect.any(Number), expect.any(Number), 16, 8);
	expect(test.gl.texImage2D).toHaveBeenCalledTimes(2);
	expect(test.gl.deleteTexture).toHaveBeenCalledOnce();
});
