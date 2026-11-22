import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import initView, { createEditorDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { AsciiRenderer } from '@8f4e/web-ui-testing';
import { expect, test, vi } from 'vitest';
import { tooltipsPlugin } from '../index';
import { createCompilerResult } from './compilerResult';
import { createEvents } from './events';

test.each([
	{ name: 'instruction stack analysis', row: 4, inline: false, call: false },
	{ name: 'live memory values', row: 1, inline: false, call: false },
	{ name: 'inline arithmetic operand', row: 3, inline: true, call: false },
	{ name: 'continued arithmetic operand', row: 3, inline: true, call: false, continued: true },
	{ name: 'named call signature', row: 1, inline: false, call: true },
	{ name: 'documented call', row: 1, inline: false, call: true, documented: true },
])('tooltips plugin draws $name', async ({ name, row, inline, call, continued, documented }) => {
	const now = vi.spyOn(performance, 'now').mockReturnValue(0);
	const width = 768;
	const height = 320;
	const ascii = new AsciiRenderer(width, height);
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
${documented ? '; @doc Combines two values.\n; @returns Sum of the inputs.\n; @param left First value.\n' : ''}param float left
${documented ? '; @param right Second value.\n' : ''}param float right
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
	const compiled = await compileProject(project, { includeStackAnalysis: true });
	const events = createEvents();
	const store = initState(events, { initialGridSize: { vGrid: 8, hGrid: 16 }, callbacks: {} });
	store.set('editorMode', 'edit');
	const drawers = createEditorDrawerRegistry();
	const disposePlugin = tooltipsPlugin.setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		drawers,
	});
	const state = store.getState();
	state.viewport.width = width;
	state.viewport.height = height;
	store.set('initialProjectState', project);
	store.set('compiler.result', createCompilerResult(compiled, state.compilerInputRevision));
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

	const renderer = await initView(store, events, ascii, memoryViews, {
		loading: store.loading,
		drawers,
	});

	now.mockReturnValue(1000);
	try {
		renderer.renderFrame();
		await expect(`${ascii.toText()}\n`).toMatchFileSnapshot(
			`./__snapshots__/${name.replaceAll(' ', '-')}.viewport.snap`
		);
	} finally {
		renderer.destroy();
		disposePlugin();
		store.dispose();
		now.mockRestore();
	}
});
