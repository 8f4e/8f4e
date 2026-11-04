import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPlugin, type EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { gapCalculator } from '@8f4e/editor-state';
import { afterEach, expect, test } from 'vitest';
import { connectorsPlugin } from '../src/index';

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

async function setup(text = source) {
	const project = parseProjectSource(text);
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
	const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as CallableFunction)();
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
	const editor: Editor = await initEditor(canvas, {
		initialProject: project,
		featureFlags: { offscreenBlockArrows: false },
		plugins: [connectorsPlugin, installArtifacts],
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
	return { editor, canvas, render, events: editorEvents!, context, memory };
}

test('renders expanded shape and paramShape declarations with aligned connectors', async () => {
	const { editor, canvas, render, context, memory } = await setup(`8f4e/v1
constants env
; @pos 100 100
constantsEnd
prototype voiceState
; @pos 100 100
int* input
int output
prototypeEnd
function process
; @pos 48 12
paramShape voiceState
functionEnd
entry main
module source
; @pos 48 2
int output 1
moduleEnd
module sink
; @pos 2 2
shape voiceState
moduleEnd
entryEnd`);
	const plan = editor.state.compiler.result.memoryPlan.modules;
	new Int32Array(memory.buffer)[plan.sink.memory.input.allocationUnitAddress] = plan.source.memory.output.byteAddress;
	const removeText = context.drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
		codeBlock.displayModel.lines.forEach((line, row) =>
			draw.drawText(
				(codeBlock.lineNumberColumnWidth + 2) * state.viewport.vGrid,
				gapCalculator(row, codeBlock.gaps) * state.viewport.hGrid,
				line.text,
				PALETTE_INDICES.inkBase
			)
		);
	});
	cleanups.push(removeText);
	render();
	await expect(canvas).toMatchScreenshot('expanded-declarations');
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
