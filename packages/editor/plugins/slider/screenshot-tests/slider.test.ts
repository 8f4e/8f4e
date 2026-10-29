import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { resolvePalette } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import loadFontAtlas from '@8f4e/sprite-generator';
import initView, { createCodeBlockDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { createWebUiRenderProjection } from '@8f4e/web-ui-render-projection';
import { expect, test } from 'vitest';
import { createEvents } from '../src/__tests__/events';
import { createSliderPlugin } from '../src/index';

test('slider plugin draws minimum middle and maximum values', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const project = parseProjectSource(`8f4e/v1
entry main
module audio
; @pos 4 3
float minimum 0.0
float middle 0.5
float maximum 1.0
; @slider &minimum 0 1
; @slider &middle 0 1 0.01
; @slider &maximum 0 1
moduleEnd
entryEnd`);
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const events = createEvents();
	const store = initState(events, {
		initialEditorMode: 'edit',
		runtimeRegistry: {},
		callbacks: {},
	});
	const drawers = createCodeBlockDrawerRegistry();
	const disposePlugin = createSliderPlugin({ writeMemory: () => {} }).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		drawers,
	});
	const state = store.getState();
	state.viewport.width = canvas.width;
	state.viewport.height = canvas.height;
	state.compiler.memoryPlan = compiled.memoryPlan;
	state.compiler.memoryDefaultsByModuleId = compiled.memoryDefaultsByModuleId;
	state.compiler.compiledModules = compiled.compiledModules;
	state.compiler.compiledFunctions = compiled.compiledFunctions;
	store.set('initialProjectState', project);
	const codeBlock = state.codeBlockRendering.codeBlocks.find(block => block.name === 'audio')!;
	store.set('codeBlockRendering.codeBlocks', [codeBlock]);
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
	memoryViews.float32[memory.minimum.allocationUnitAddress] = 0;
	memoryViews.float32[memory.middle.allocationUnitAddress] = 0.5;
	memoryViews.float32[memory.maximum.allocationUnitAddress] = 1;
	const spriteData = await loadFontAtlas(state.editorConfig.font);
	const projection = createWebUiRenderProjection(store, events);
	const renderer = await initView(
		state,
		projection,
		canvas,
		memoryViews,
		spriteData,
		resolvePalette(state.editorConfig.color),
		{ drawers }
	);
	renderer.pauseRendering();
	events.dispatch('spriteSheetRerendered');
	try {
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
		projection.dispose();
		disposePlugin();
		store.dispose();
		canvas.remove();
	}
});
