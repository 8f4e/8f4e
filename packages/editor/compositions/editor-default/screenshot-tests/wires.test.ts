import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initEditor, {
	type Editor,
	type EditorPlugin,
	type EditorPluginContext,
	getEditorBlockId,
} from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { connectorsPlugin } from '@8f4e/editor-plugin-connectors';
import { coordinateGridPlugin } from '@8f4e/editor-plugin-coordinate-grid';
import { createElasticViewportPlugin } from '@8f4e/editor-plugin-elastic-viewport';
import { wiresPlugin } from '@8f4e/editor-plugin-wires';
import { displayRowToGridRow } from '@8f4e/editor-state';
import type { InternalPointerEvent } from '@8f4e/editor-state-types';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';
import { Engine } from 'glugglugglug';
import { afterEach, expect, test, vi } from 'vitest';

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
	let context!: EditorPluginContext;
	const captureContext: EditorPlugin = {
		id: 'capture-context',
		setup: services => {
			context = services;
			return () => {};
		},
	};
	const renderer = new Engine(canvas);
	const editor: Editor = await initEditor(canvas, {
		renderer,
		initialProject: project,
		plugins: [...plugins, captureContext],
	});
	cleanups.push(() => {
		editor.dispose();
		canvas.remove();
	});
	context.events.dispatch('compilationSucceeded', { memoryRef: memory });
	context.store.set('compiler.result', { ...compiled, inputRevision: editor.state.compilerInputRevision });
	const render = () => {
		editor.pauseRendering();
		editor.state.viewport.x = 0;
		editor.state.viewport.y = 0;
		editor.renderFrame();
	};
	render();
	return {
		editor,
		canvas,
		render,
		events: context.events,
		context,
		memory,
		project,
		compiled,
		gl: renderer.gl,
		renderer,
	};
}

function registerSourceText(context: EditorPluginContext) {
	const glyphsByBlock = new WeakMap<object, GlyphIds[]>();
	const removePreparation = context.layout.subscribe(({ codeBlock }) => {
		glyphsByBlock.set(
			codeBlock,
			codeBlock.displayModel.lines.map(line => textToGlyphIds(line.text))
		);
	});
	const removeText = context.renderRegistry.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
		codeBlock.displayModel.lines.forEach((line, row) =>
			draw.drawGlyphs(
				(codeBlock.lineNumberColumnWidth + 2) * state.viewport.vGrid,
				displayRowToGridRow(row, codeBlock.gaps) * state.viewport.hGrid,
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
	const blocks = editor.state.project.activeLevel.blocks;
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
	expect(connected[3]).toBeGreaterThan(0);
	new Int32Array(memory.buffer)[compiled.memoryPlan.modules.amplifier.memory.input.allocationUnitAddress] = -1;
	render();
	expect(readPixel()).toEqual([0, 0, 0, 0]);
});

test('renders connectors and wires through the editor and restores them after GPU memory release', async () => {
	const { editor, canvas, render } = await setup();
	await expect(canvas).toMatchScreenshot('connector-wires');
	editor.releaseRenderingResources();
	editor.resize(800, 400);
	render();
	await expect(canvas).toMatchScreenshot('connector-wires');
});

test('elastic panning keeps wires attached while grid markers and hit targets follow the viewport', async () => {
	const extraRows = Array.from({ length: 24 }, (_, index) => `float gain${index} 0`).join('\n');
	const { editor, canvas, gl, context, events, renderer } = await setup(
		`8f4e/v1
constants env
; @pos 100 100
constantsEnd
entry main
module oscillator
; @pos 10 8
float output 0.5
moduleEnd

module replicator
; @pos 10 14
float output 0.5
moduleEnd
module amplifier
; @pos 48 3
float* input &oscillator:output
${extraRows}
moduleEnd
entryEnd`,
		[
			coordinateGridPlugin,
			connectorsPlugin,
			wiresPlugin,
			createElasticViewportPlugin({ prefersReducedMotion: () => false }),
		]
	);
	const { state } = editor;
	// Keep the world origin visible both before and after the pan.
	state.viewport.x = -64;
	state.viewport.y = -32;
	const initialViewportX = state.viewport.x;
	const blocks = state.project.activeLevel.blocks;
	const output = blocks.find(block => block.name === 'oscillator')!;
	const replica = blocks.find(block => block.name === 'replicator')!;
	const input = blocks.find(block => block.name === 'amplifier')!;
	expect(replica).toMatchObject({ width: output.width, height: output.height });
	const outputWorldX = output.x;
	const inputWorldX = input.x;
	let presentedOutputX = 0;
	let presentedInputX = 0;
	let presentedReplicaX = 0;
	cleanups.push(
		context.renderRegistry.registerCanvasBackgroundDrawer(({ blockPositions }) => {
			presentedOutputX = blockPositions.byCodeBlock.get(output)!.x;
			presentedInputX = blockPositions.byCodeBlock.get(input)!.x;
			presentedReplicaX = blockPositions.byCodeBlock.get(replica)!.x;
		})
	);
	const start = performance.now() + 200;
	const clock = vi.spyOn(performance, 'now');
	const upload = vi.spyOn(gl, 'bufferSubData');
	const sprites = vi.spyOn(renderer, 'drawSprite');
	cleanups.push(() => {
		clock.mockRestore();
		upload.mockRestore();
		sprites.mockRestore();
	});
	const marker = () =>
		sprites.mock.calls
			.find(([, , , color, width, height]) => color === PALETTE_INDICES.mutedBase && width === 3 && height === 3)
			?.slice(0, 2);
	const frame = (elapsed: number) => {
		clock.mockReturnValue(start + elapsed);
		upload.mockClear();
		sprites.mockClear();
		editor.renderFrame();
		// Wires run after sprites. The first four floats are the line's two pixel endpoints.
		const bytes = upload.mock.calls.at(-1)?.[2] as Uint8Array;
		const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		return [data.getFloat32(0, true), data.getFloat32(4, true), data.getFloat32(8, true), data.getFloat32(12, true)];
	};
	const [inputWireX, inputWireY, outputWireX, outputWireY] = frame(0);
	expect(marker()).toEqual([63, 31]);
	const initialOutputX = presentedOutputX;
	const initialInputX = presentedInputX;
	const pointer: InternalPointerEvent = {
		x: 0,
		y: 0,
		movementX: -40,
		movementY: 0,
		buttons: 1,
		altKey: false,
		stopPropagation: false,
		canvasWidth: canvas.width,
		canvasHeight: canvas.height,
	};
	events.dispatch('pointermove', pointer);
	expect(state.viewport.x).toBe(initialViewportX + 40);
	const logicalOutputX = outputWorldX - state.viewport.x;
	const logicalInputX = inputWorldX - state.viewport.x;
	const logicalReplicaX = replica.x - state.viewport.x;
	const expectWireAtPresentedPositions = (wire: number[]) => {
		expect(wire).toEqual([
			inputWireX + presentedInputX - initialInputX,
			inputWireY,
			outputWireX + presentedOutputX - initialOutputX,
			outputWireY,
		]);
	};
	const first = frame(16);
	expect(marker()).toEqual([23, 31]);
	const firstOutputLag = presentedOutputX - logicalOutputX;
	const firstInputLag = presentedInputX - logicalInputX;
	// Both sizes move immediately, and their responses differ from the very first pan frame.
	expect(firstOutputLag).toBeGreaterThan(0);
	expect(firstInputLag).toBeGreaterThan(firstOutputLag);
	expect(firstInputLag).toBeLessThan(40);
	expect(presentedReplicaX - logicalReplicaX).toBe(firstOutputLag);
	expectWireAtPresentedPositions(first);

	const mid = frame(80);
	expect(marker()).toEqual([23, 31]);
	const outputLag = presentedOutputX - logicalOutputX;
	const inputLag = presentedInputX - logicalInputX;
	expect(outputLag).toBeGreaterThan(1);
	expect(inputLag).toBeGreaterThan(outputLag);
	expectWireAtPresentedPositions(mid);

	const hit = vi.fn();
	events.on('codeBlockPointerDown', hit, { capture: true });
	const y = output.y - state.viewport.y + 4;
	// Probe both a logical-only pixel and a rendered-only pixel without committing a selection or drag.
	events.dispatch('pointerdown', { ...pointer, x: logicalOutputX + 1, y }, { phase: 'capture' });
	expect(hit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ codeBlock: output }));
	hit.mockClear();
	events.dispatch('pointerdown', { ...pointer, x: logicalOutputX + output.width + 1, y }, { phase: 'capture' });
	expect(hit).not.toHaveBeenCalled();
	events.off('codeBlockPointerDown', hit);

	let didOvershoot = false;
	let last = mid;
	for (let elapsed = 96; elapsed <= 1000; elapsed += 16) {
		last = frame(elapsed);
		didOvershoot ||= presentedOutputX < logicalOutputX;
	}
	expect(didOvershoot).toBe(true);
	expect([presentedOutputX, presentedInputX, presentedReplicaX]).toEqual([
		logicalOutputX,
		logicalInputX,
		logicalReplicaX,
	]);
	expect(last).toEqual([inputWireX - 40, inputWireY, outputWireX - 40, outputWireY]);
	expect([output.x, input.x, state.viewport.x]).toEqual([outputWorldX, inputWorldX, initialViewportX + 40]);
});

test('renders a wire crossing the viewport when both connected blocks are offscreen', async () => {
	const { editor, canvas, render } = await setup();
	const blocks = editor.state.project.activeLevel.blocks;
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

	const group = editor.state.project.activeLevel.blocks.find(block => block.name === 'storage')!;
	words[slot.allocationUnitAddress] = compiled.memoryPlan.modules['storage/samples'].memory.buffer.byteAddress;
	editor.navigation.openGroup(getEditorBlockId(group));
	render();
	await expect(canvas).toMatchScreenshot('pointer-reference-inside-group');
	editor.navigation.goToRoot();

	const relocated = await compileProject(project, { cache: compiled.cache, startingMemoryAllocationUnitAddress: 32 });
	words.fill(0);
	await initDefaults(relocated.codeBuffer, memory);
	context.store.set('compiler.result', { ...relocated, inputRevision: editor.state.compilerInputRevision });
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
	const blocks = editor.state.project.activeLevel.blocks;
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
	editor.state.project.selectedCodeBlock = undefined;
	render();
	await expect(canvas).toMatchScreenshot('module-overrides');
});
