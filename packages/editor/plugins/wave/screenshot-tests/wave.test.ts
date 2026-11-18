import { compileProject, parseProjectSource } from '@8f4e/compiler';
import type { PaletteConfig } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import initView, { createEditorDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { expect, test } from 'vitest';
import { createEvents } from '../src/__tests__/events';
import { wavePlugin } from '../src/index';

type WaveMemory = Awaited<ReturnType<typeof compileProject>>['memoryPlan']['modules'][string]['memory'];

async function drawWaveFixture(
	source: string,
	initialize: (views: MemoryViews, memory: WaveMemory) => void,
	colors: PaletteConfig = {}
) {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const project = parseProjectSource(`8f4e/v1
entry main
module audio
; @pos 4 3
${source}
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
	store.set('editorConfig.color', colors);
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
	initialize(memoryViews, compiled.memoryPlan.modules.audio.memory);

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

test('wave plugin draws all heights with a live playhead', () =>
	drawWaveFixture(
		`float[] samples 64
float& buffer &samples
float* playhead &samples
; @wave &samples count(samples) playhead
; @wave2 buffer count(buffer) playhead
; @wave4 buffer count(buffer) playhead`,
		(views, memory) => {
			for (let index = 0; index < 64; index++)
				views.float32[memory.samples.byteAddress / 4 + index] = Math.sin((index * Math.PI * 4) / 63);
			views.int32[memory.playhead.allocationUnitAddress] = memory.samples.byteAddress + 40 * 4;
		}
	));

test('wave plugin follows double pointers to int16 samples', () =>
	drawWaveFixture(
		`int16[] samples 64
int16* selected &samples
int16** buffer &selected
int16* playhead &samples
int16** cursor &playhead
; @wave &samples count(samples) playhead
; @wave2 *buffer count(samples) *cursor
; @wave4 *buffer count(samples) *cursor`,
		(views, memory) => {
			for (let index = 0; index < 64; index++)
				views.int16[memory.samples.byteAddress / 2 + index] = Math.round(Math.sin((index * Math.PI * 4) / 63) * 32767);
			views.int32[memory.playhead.allocationUnitAddress] = memory.samples.byteAddress + 40 * 2;
			views.int32[memory.selected.allocationUnitAddress] = memory.samples.byteAddress;
			views.int32[memory.buffer.allocationUnitAddress] = memory.selected.byteAddress;
			views.int32[memory.cursor.allocationUnitAddress] = memory.playhead.byteAddress;
		}
	));

test('wave playhead remains visible with dark code colors on a gray theme', () =>
	drawWaveFixture(
		`float[] samples 64
float* playhead &samples
; @wave4 &samples count(samples) playhead`,
		(views, memory) => {
			for (let index = 0; index < 64; index++)
				views.float32[memory.samples.byteAddress / 4 + index] = Math.sin((index * Math.PI * 4) / 63);
			views.int32[memory.playhead.allocationUnitAddress] = memory.samples.byteAddress + 40 * 4;
		},
		{
			canvas: '#818c8e',
			surface: '#96a1a3',
			ink: '#1d282e',
			primary: '#5b1a29',
			secondary: '#09324f',
			highlight: '#80d2dc',
			warning: '#efb567',
		}
	));
