import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { resolvePalette } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import loadFontAtlas from '@8f4e/sprite-generator';
import initView, { createEditorDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { createWebUiRenderProjection } from '@8f4e/web-ui-render-projection';
import { expect, test } from 'vitest';
import { createEvents } from '../src/__tests__/events';
import { createButtonPlugin } from '../src/index';

test('button plugin draws off and on values', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 256;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const project = parseProjectSource(`8f4e/v1
entry main
module controls
int off 0
int on 1
; @button &off
; @button &on
moduleEnd
entryEnd`);
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const events = createEvents();
	const store = initState(events, {
		callbacks: {},
	});
	store.set('editorMode', 'edit');
	const drawers = createEditorDrawerRegistry();
	const disposePlugin = createButtonPlugin({ writeMemory: () => {} }).setup({
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
	state.compiler.result.memoryPlan = compiled.memoryPlan;
	state.compiler.result.memoryDefaultsByModuleId = compiled.memoryDefaultsByModuleId;
	state.compiler.result.compiledModules = compiled.compiledModules;
	state.compiler.result.compiledFunctions = compiled.compiledFunctions;
	store.set('initialProjectState', project);
	const codeBlock = state.codeBlockRendering.codeBlocks.find(block => block.name === 'controls')!;
	store.set('codeBlockRendering.codeBlocks', [codeBlock]);
	codeBlock.gridX = 4;
	codeBlock.gridY = 2;
	codeBlock.x = 32;
	codeBlock.y = 32;
	state.editorConfig.color = {
		canvas: '#000',
		surface: '#111',
		primary: '#336699',
		ink: '#ffcc00',
	};
	const buffer = new ArrayBuffer(65536);
	const memoryViews: MemoryViews = {
		int8: new Int8Array(buffer),
		int16: new Int16Array(buffer),
		int32: new Int32Array(buffer),
		uint8: new Uint8Array(buffer),
		uint16: new Uint16Array(buffer),
		float32: new Float32Array(buffer),
		float64: new Float64Array(buffer),
	};
	memoryViews.int32[compiled.memoryPlan.modules.controls.memory.on.allocationUnitAddress] = 1;
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
