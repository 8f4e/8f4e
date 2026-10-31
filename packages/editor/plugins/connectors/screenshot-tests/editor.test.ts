import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPlugin } from '@8f4e/editor-core';
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

async function setup() {
	const project = parseProjectSource(source);
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
	const installArtifacts: EditorPlugin = {
		id: 'test-artifacts',
		setup: ({ store, events }) => {
			Object.assign(store.getState().compiler.result, {
				memoryPlan: compiled.memoryPlan,
				memoryDefaultsByModuleId: compiled.memoryDefaultsByModuleId,
				compiledModules: compiled.compiledModules,
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
	return { editor, canvas, render };
}

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
	const blocks = editor.state.codeBlockRendering.codeBlocks;
	blocks.find(block => block.name === 'oscillator')!.x = -600;
	blocks.find(block => block.name === 'amplifier')!.x = 1200;
	blocks.find(block => block.name === 'speaker')!.x = -600;
	render();
	await expect(canvas).toMatchScreenshot('offscreen-wires');
});
