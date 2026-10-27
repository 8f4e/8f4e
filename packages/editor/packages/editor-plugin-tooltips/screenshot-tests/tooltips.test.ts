import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { resolvePalette } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import loadFontAtlas from '@8f4e/sprite-generator';
import initView, { createCodeBlockDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { createWebUiRenderProjection } from '@8f4e/web-ui-render-projection';
import { expect, test, vi } from 'vitest';
import { createEvents } from '../src/__tests__/events';
import { tooltipsPlugin } from '../src/index';

test.each([
	{ name: 'instruction stack analysis', row: 4 },
	{ name: 'live memory values', row: 1 },
])('tooltips plugin draws $name', async ({ row }) => {
	const now = vi.spyOn(performance, 'now').mockReturnValue(0);
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 320;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const project = parseProjectSource(`8f4e/v1
entry main
module controls
int value 42
push 1
push 2
add
drop
moduleEnd
entryEnd`);
	const compiled = await compileProject(project, { disableSharedMemory: true, includeStackAnalysis: true });
	const events = createEvents();
	const store = initState(events, {
		initialEditorMode: 'edit',
		runtimeRegistry: {},
		callbacks: { loadSession: async () => null },
	});
	const drawers = createCodeBlockDrawerRegistry();
	const disposePlugin = tooltipsPlugin.setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		drawers,
	});
	const state = store.getState();
	state.viewport.width = canvas.width;
	state.viewport.height = canvas.height;
	Object.assign(state.compiler, compiled);
	store.set('initialProjectState', project);
	const codeBlock = state.codeBlockRendering.codeBlocks.find(block => block.name === 'controls')!;
	store.set('codeBlockRendering.codeBlocks', [codeBlock]);
	codeBlock.gridX = 55;
	codeBlock.gridY = 4;
	codeBlock.x = 440;
	codeBlock.y = 64;
	store.set('codeBlockRendering.selectedCodeBlock', codeBlock);
	store.set('codeBlockRendering.selectedCodeBlock.cursor.row', row);
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
	memoryViews.int32[compiled.memoryPlan.modules.controls.memory.value.allocationUnitAddress] = 42;
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
	now.mockReturnValue(1000);
	try {
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
		projection.dispose();
		disposePlugin();
		store.dispose();
		now.mockRestore();
		canvas.remove();
	}
});
