import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import initView, { createEditorDrawerRegistry, type GlyphIds, type MemoryViews, textToGlyphIds } from '@8f4e/web-ui';
import { expect, test, vi } from 'vitest';
import { createEvents } from '../src/__tests__/events';
import { tooltipsPlugin } from '../src/index';

test.each([
	{ name: 'fixed-reference', declaration: 'float&' },
	{ name: 'allocated-pointer', declaration: 'float*' },
])('inspects a $name beside the other declaration', async ({ name, declaration }) => {
	const project = parseProjectSource(`8f4e/v1
constants env
; @pos 150 100
constantsEnd
entry main
module source
; @pos 50 15
float[] output 2 1.5 2.5
moduleEnd
module inspect
; @pos 50 4
float& input &source:output
float* pointer &source:output
moduleEnd
entryEnd`);
	const compiled = await compileProject(project);
	const now = vi.spyOn(performance, 'now').mockReturnValue(0);
	const canvas = document.createElement('canvas');
	canvas.width = 800;
	canvas.height = 400;
	document.body.append(canvas);
	const events = createEvents();
	const store = initState(events, { callbacks: {} });
	const drawers = createEditorDrawerRegistry();
	const glyphsByBlock = new WeakMap<object, GlyphIds[]>();
	const removePreparation = store.layout.subscribe(({ codeBlock }) => {
		glyphsByBlock.set(
			codeBlock,
			codeBlock.displayModel.lines.map(line => textToGlyphIds(line.text))
		);
	});
	const disposeFixture = drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
		codeBlock.code.forEach((line, row) => {
			const selected = state.codeBlockRendering.selectedCodeBlock === codeBlock && row === codeBlock.cursor.row;
			if (selected) {
				draw.drawFill(
					0,
					row * state.viewport.hGrid,
					PALETTE_INDICES.selectionSurface,
					codeBlock.width,
					state.viewport.hGrid
				);
			}
			draw.drawGlyphs(
				state.viewport.vGrid,
				row * state.viewport.hGrid,
				glyphsByBlock.get(codeBlock)![row],
				selected ? PALETTE_INDICES.selectionInk : PALETTE_INDICES.inkBase
			);
		});
	});
	const disposePlugin = tooltipsPlugin.setup({
		store,
		events,
		drawers,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
	});
	const state = store.getState();
	state.viewport.width = canvas.width;
	state.viewport.height = canvas.height;
	store.set('editorMode', 'edit');
	store.set('compiler.result', compiled);
	store.set('initialProjectState', project);
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'inspect')!;
	store.set('codeBlockRendering.selectedCodeBlock', block);
	store.set(
		'codeBlockRendering.selectedCodeBlock.cursor.row',
		block.code.findIndex(line => line.startsWith(declaration))
	);
	state.viewport.x = 0;
	state.viewport.y = 0;
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
	const target = compiled.memoryPlan.modules.source.memory.output;
	memoryViews.float32[target.allocationUnitAddress] = 1.5;
	memoryViews.float32[target.allocationUnitAddress + 1] = 2.5;
	memoryViews.int32[compiled.memoryPlan.modules.inspect.memory.pointer.allocationUnitAddress] = target.byteAddress;
	const renderer = await initView(store, events, canvas, memoryViews, { loading: store.loading, drawers });
	try {
		now.mockReturnValue(1000);
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot(name);
	} finally {
		renderer.destroy();
		disposePlugin();
		removePreparation();
		disposeFixture();
		store.dispose();
		now.mockRestore();
		canvas.remove();
	}
});
