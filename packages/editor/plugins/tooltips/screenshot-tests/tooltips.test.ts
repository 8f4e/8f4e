import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import initView, { createEditorDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { expect, test, vi } from 'vitest';
import { createEvents } from '../src/__tests__/events';
import { tooltipsPlugin } from '../src/index';

test.each([
	{ name: 'instruction stack analysis', row: 4, inline: false, call: false },
	{ name: 'live memory values', row: 1, inline: false, call: false },
	{ name: 'inline arithmetic operand', row: 3, inline: true, call: false },
	{ name: 'continued arithmetic operand', row: 3, inline: true, call: false, continued: true },
	{ name: 'named call signature', row: 1, inline: false, call: true },
])('tooltips plugin draws $name', async ({ row, inline, call, continued }) => {
	const now = vi.spyOn(performance, 'now').mockReturnValue(0);
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 320;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const project = parseProjectSource(
		call
			? `8f4e/v1
entry main
module controls
call mix 0.2 0.8
drop
moduleEnd
entryEnd
function mix
param float left
param float right
push left
push right
add
functionEnd float`
			: `8f4e/v1
entry main
module controls
int value 42
push 1
${inline ? (continued ? 'add ; operand below\n- 2 ; right operand' : 'add 2') : 'push 2\nadd'}
drop
moduleEnd
entryEnd`
	);
	const compiled = await compileProject(project, { disableSharedMemory: true, includeStackAnalysis: true });
	const events = createEvents();
	const store = initState(events, {
		callbacks: {},
	});
	store.set('editorMode', 'edit');
	const drawers = createEditorDrawerRegistry();
	const disposePlugin = tooltipsPlugin.setup({
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
	Object.assign(state.compiler.result, compiled);
	store.set('initialProjectState', project);
	const codeBlock = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'controls')!;
	store.set('codeBlockRendering.currentProject.blocks', [codeBlock]);
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
	if (!call) memoryViews.int32[compiled.memoryPlan.modules.controls.memory.value.allocationUnitAddress] = 42;

	const renderer = await initView(store, events, canvas, memoryViews, {
		drawers,
	});

	now.mockReturnValue(1000);
	try {
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
		disposePlugin();
		store.dispose();
		now.mockRestore();
		canvas.remove();
	}
});
