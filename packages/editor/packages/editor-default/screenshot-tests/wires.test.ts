import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initEditor, {
	type Editor,
	type EditorPlugin,
	type EditorPluginContext,
	getEditorBlockId,
} from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { connectorsPlugin } from '@8f4e/editor-plugin-connectors';
import { wiresPlugin } from '@8f4e/editor-plugin-wires';
import { gapCalculator } from '@8f4e/editor-state';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';
import { Engine } from 'glugglugglug';
import { afterEach, expect, test } from 'vitest';

const source = `8f4e/v1
constants env
; @pos 100 100
constantsEnd
entry main
module oscillator
; @pos 2 2
float output 0.5
moduleEnd
module amplifier
; @pos 45 9
float* input &oscillator:output
float output 0.25
moduleEnd
module speaker
; @pos 2 18
float* input &amplifier:output
moduleEnd
entryEnd`;

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

async function initDefaults(codeBuffer: Uint8Array, memory: WebAssembly.Memory) {
	const { instance } = await WebAssembly.instantiate(new Uint8Array(codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as CallableFunction)();
}

async function setup(text = source, plugins: readonly EditorPlugin[] = [connectorsPlugin, wiresPlugin]) {
	const project = parseProjectSource(text);
	const compiled = await compileProject(project);
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
	await initDefaults(compiled.codeBuffer, memory);
	const canvas = document.createElement('canvas');
	canvas.width = 800;
	canvas.height = 400;
	canvas.style.width = '800px';
	canvas.style.height = '400px';
	document.body.appendChild(canvas);
	let editorEvents: EditorPluginContext['events'];
	let context!: EditorPluginContext;
	const installArtifacts: EditorPlugin = {
		id: 'test-artifacts',
		setup: services => {
			context = services;
			const { store, events } = services;
			editorEvents = events;
			Object.assign(store.getState().compiler.result, {
				memoryPlan: compiled.memoryPlan,
				memoryDefaultsByModuleId: compiled.memoryDefaultsByModuleId,
				compiledModules: compiled.compiledModules,
				compiledFunctions: compiled.compiledFunctions,
				projectMemoryExposuresByGroupPath: compiled.projectMemoryExposuresByGroupPath,
			});
			events.dispatch('compilationSucceeded', { memoryRef: memory });
			return () => {};
		},
	};
	const renderer = new Engine(canvas);
	const editor: Editor = await initEditor(canvas, {
		renderer,
		initialProject: project,
		plugins: [...plugins, installArtifacts],
	});
	cleanups.push(() => {
		editor.dispose();
		canvas.remove();
	});
	const render = () => {
		editor.pauseRendering();
		editor.state.viewport.x = 0;
		editor.state.viewport.y = 0;
		editor.renderFrame();
	};
	render();
	return { editor, canvas, render, events: editorEvents!, context, memory, project, compiled, gl: renderer.gl };
}

function registerSourceText(context: EditorPluginContext) {
	const glyphsByBlock = new WeakMap<object, GlyphIds[]>();
	const removePreparation = context.layout.subscribe(({ codeBlock }) => {
		glyphsByBlock.set(
			codeBlock,
			codeBlock.displayModel.lines.map(line => textToGlyphIds(line.text))
		);
	});
	const removeText = context.drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
		codeBlock.displayModel.lines.forEach((line, row) =>
			draw.drawGlyphs(
				(codeBlock.lineNumberColumnWidth + 2) * state.viewport.vGrid,
				gapCalculator(row, codeBlock.gaps) * state.viewport.hGrid,
				glyphsByBlock.get(codeBlock)![row],
				PALETTE_INDICES.inkBase
			)
		);
	});
	cleanups.push(removeText, removePreparation);
}

test('draws a live wire with the connector presentation plugin omitted', async () => {
	const { editor, canvas, gl, render, memory, compiled } = await setup(
		`8f4e/v1
entry main
module oscillator
; @pos 2 2
float output 0.5
moduleEnd
module amplifier
; @pos 45 2
float* input &oscillator:output
moduleEnd
entryEnd`,
		[wiresPlugin]
	);
	const blocks = editor.state.codeBlockRendering.currentProject.blocks;
	const outputBlock = blocks.find(block => block.name === 'oscillator')!;
	const inputBlock = blocks.find(block => block.name === 'amplifier')!;
	const { hGrid } = editor.state.viewport;
	const x = Math.floor((outputBlock.x + outputBlock.width + inputBlock.x) / 2);
	const y = inputBlock.y + Math.round(2.5 * hGrid);
	const readPixel = () => {
		const pixel = new Uint8Array(4);
		gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
		return [...pixel];
	};
	const connected = readPixel();
	new Int32Array(memory.buffer)[compiled.memoryPlan.modules.amplifier.memory.input.allocationUnitAddress] = -1;
	render();
	expect(connected).not.toEqual(readPixel());
});

test('renders connectors and wires through the editor and restores them after GPU memory release', async () => {
	const { editor, canvas, render } = await setup();
	await expect(canvas).toMatchScreenshot('connector-wires');
	editor.releaseRenderingResources();
	editor.resize(800, 400);
	render();
	await expect(canvas).toMatchScreenshot('connector-wires');
});

test('renders a wire crossing the viewport when both connected blocks are offscreen', async () => {
	const { editor, canvas, render } = await setup();
	const blocks = editor.state.codeBlockRendering.currentProject.blocks;
	blocks.find(block => block.name === 'oscillator')!.x = -600;
	blocks.find(block => block.name === 'amplifier')!.x = 1200;
	blocks.find(block => block.name === 'speaker')!.x = -600;
	render();
	await expect(canvas).toMatchScreenshot('offscreen-wires');
});

test('renders fixed reference wires without allocated pointer slots and restores them after GPU release', async () => {
	const { editor, canvas, render } = await setup(source.replaceAll('float* input', 'float& input'));
	await expect(canvas).toMatchScreenshot('fixed-reference-wires');
	editor.releaseRenderingResources();
	editor.resize(800, 400);
	render();
	await expect(canvas).toMatchScreenshot('fixed-reference-wires');
});

test('keeps the fixed wire on the exposed pointer slot as its live wire moves', async () => {
	const { editor, canvas, render, context, project, compiled, memory } = await setup(`8f4e/v1
constants env
; @pos 100 100
constantsEnd
entry main
group storage
; @pos 32 10
expose selected &selector:address
entry main
module samples
; @pos 2 2
int16[] buffer 2 -32768 123
moduleEnd
module selector
; @pos 34 8
int16* address &samples:buffer
moduleEnd
module monitor
; @pos 12 18
int16*& input &selector:address
moduleEnd
entryEnd
groupEnd
module firstBuffer
; @pos 2 2
int16[] samples 2 -32768 123
moduleEnd
module secondBuffer
; @pos 49 2
int16[] samples 2 32767 -123
moduleEnd
module player
; @pos 5 18
int16*& input &storage:selected
moduleEnd
entryEnd`);
	const words = new Int32Array(memory.buffer);
	const slot = compiled.memoryPlan.modules['storage/selector'].memory.address;
	registerSourceText(context);
	const first = compiled.memoryPlan.modules.firstBuffer.memory.samples;
	const second = compiled.memoryPlan.modules.secondBuffer.memory.samples;

	words[slot.allocationUnitAddress] = first.byteAddress;
	render();
	await expect(canvas).toMatchScreenshot('pointer-reference-first-buffer');

	words[slot.allocationUnitAddress] = second.byteAddress;
	render();
	await expect(canvas).toMatchScreenshot('pointer-reference-second-buffer');

	const group = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'storage')!;
	words[slot.allocationUnitAddress] = compiled.memoryPlan.modules['storage/samples'].memory.buffer.byteAddress;
	editor.navigation.openGroup(getEditorBlockId(group));
	render();
	await expect(canvas).toMatchScreenshot('pointer-reference-inside-group');
	editor.navigation.goToRoot();

	const relocated = await compileProject(project, { cache: compiled.cache, startingMemoryAllocationUnitAddress: 32 });
	words.fill(0);
	await initDefaults(relocated.codeBuffer, memory);
	context.store.set('compiler.result', { ...editor.state.compiler.result, ...relocated });
	context.store.set('compiler.isCompiling', true);
	context.store.set('compiler.isCompiling', false);
	const relocatedSlot = relocated.memoryPlan.modules['storage/selector'].memory.address;
	expect(relocatedSlot.byteAddress).not.toBe(slot.byteAddress);
	words[relocatedSlot.allocationUnitAddress] = relocated.memoryPlan.modules.secondBuffer.memory.samples.byteAddress;
	render();
	await expect(canvas).toMatchScreenshot('pointer-reference-second-buffer');
});

test('keeps wires on the active override after selecting same-named modules', async () => {
	const { editor, canvas, render, events } = await setup(`8f4e/v1
constants env
; @pos 100 100
constantsEnd
entry main
module oscillator
; @pos 2 2
float output 0.25
moduleEnd
module oscillator
; @pos 45 2
float output 0.5
moduleEnd
module speaker
; @pos 2 18
float* input &oscillator:output
moduleEnd
entryEnd`);
	const blocks = editor.state.codeBlockRendering.currentProject.blocks;
	const oscillators = blocks.filter(block => block.name === 'oscillator');
	const speaker = blocks.find(block => block.name === 'speaker')!;
	for (const block of [...oscillators, speaker]) {
		events.dispatch('pointerdown', {
			x: block.x - editor.state.viewport.x + 1,
			y: block.y - editor.state.viewport.y + 1,
			movementX: 0,
			movementY: 0,
			buttons: 1,
			stopPropagation: false,
			canvasWidth: 800,
			canvasHeight: 400,
			altKey: false,
		});
		events.dispatch('pointerup');
	}
	// Keep the reference independent of the animated selection border.
	editor.state.codeBlockRendering.selectedCodeBlock = undefined;
	render();
	await expect(canvas).toMatchScreenshot('module-overrides');
});
