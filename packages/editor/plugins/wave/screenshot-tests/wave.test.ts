import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import initView, { createEditorDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { expect, test } from 'vitest';
import { createEvents } from '../src/__tests__/events';
import { wavePlugin } from '../src/index';

async function drawWaveFixture(indirect = false) {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const project = parseProjectSource(`8f4e/v1
entry main
module audio
; @pos 4 3
${
	indirect
		? `int16[] samples 64
int16* selected &samples
int16** buffer &selected
int16* playhead &samples
int16** cursor &playhead
; @wave &samples count(samples) playhead
; @wave2 *buffer count(samples) *cursor
; @wave4 *buffer count(samples) *cursor`
		: `float[] samples 64
float& buffer &samples
float* playhead &samples
; @wave &samples count(samples) playhead
; @wave2 buffer count(buffer) playhead
; @wave4 buffer count(buffer) playhead`
}
moduleEnd
entryEnd`);
	const compiled = await compileProject(project);
	const events = createEvents();
	const store = initState(events, {
		callbacks: {},
	});
	store.set('editorMode', 'edit');
	const drawers = createEditorDrawerRegistry();
	const disposePlugin = wavePlugin.setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		drawers,
	});
	const state = store.getState();
	state.viewport.width = canvas.width;
	state.viewport.height = canvas.height;
	state.compiler.result.memoryPlan = compiled.memoryPlan;
	state.compiler.result.memoryDefaultsByModuleId = compiled.memoryDefaultsByModuleId;
	state.compiler.result.compiledModules = compiled.compiledModules;
	state.compiler.result.compiledFunctions = compiled.compiledFunctions;
	store.set('initialProjectState', project);
	const codeBlock = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'audio')!;
	store.set('codeBlockRendering.currentProject.blocks', [codeBlock]);
	const buffer = new ArrayBuffer(65536);
	const memoryViews: MemoryViews = {
		int8: new Int8Array(buffer),
		uint8: new Uint8Array(buffer),
		int16: new Int16Array(buffer),
		uint16: new Uint16Array(buffer),
		int32: new Int32Array(buffer),
		float32: new Float32Array(buffer),
		float64: new Float64Array(buffer),
	};
	const memory = compiled.memoryPlan.modules.audio.memory;
	for (let index = 0; index < 64; index++) {
		const value = Math.sin((index * Math.PI * 4) / 63);
		if (indirect) memoryViews.int16[memory.samples.byteAddress / 2 + index] = Math.round(value * 32767);
		else memoryViews.float32[memory.samples.allocationUnitAddress + index] = value;
	}
	memoryViews.int32[memory.playhead.allocationUnitAddress] = memory.samples.byteAddress + 40 * (indirect ? 2 : 4);
	if (indirect) {
		memoryViews.int32[memory.selected.allocationUnitAddress] = memory.samples.byteAddress;
		memoryViews.int32[memory.buffer.allocationUnitAddress] = memory.selected.byteAddress;
		memoryViews.int32[memory.cursor.allocationUnitAddress] = memory.playhead.byteAddress;
	}

	const renderer = await initView(store, events, canvas, memoryViews, {
		loading: store.loading,
		drawers,
	});

	try {
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
		disposePlugin();
		store.dispose();
		canvas.remove();
	}
}

test('wave plugin draws all heights with a live playhead', () => drawWaveFixture());
test('wave plugin follows double pointers to int16 samples', () => drawWaveFixture(true));
