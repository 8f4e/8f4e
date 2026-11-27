import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPluginContext, getEditorBlockId } from '@8f4e/editor-core';
import { resolvePalette } from '@8f4e/editor-palette';
import { createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { dialogsPlugin } from '@8f4e/editor-plugin-dialogs';
import { createLazyPluginLoaderPlugin, hasConfig, hasDirective } from '@8f4e/editor-plugin-lazy-loader';
import { displayRowToGridRow } from '@8f4e/editor-state';
import { Engine } from 'glugglugglug';
import { expect, onTestFinished, test, vi } from 'vitest';

const source = `8f4e/v1
constants env
; @pos 150 100
constantsEnd
note views
; @pos 4 3
Four framebuffer formats, one program.
; @textureUpload &screen:rgba rgba 2 2
; @texture &screen:rgba 24 2 2
; @textureUpload &screen:rgb rgb 3 2
; @texture &screen:rgb 16 3 2
; @textureUpload &screen:mono mono 3 2
; @texture &screen:mono 16 3 2
; @textureUpload &screen:bits 1bit 10 2
; @texture &screen:bits 6 10 2
Code follows the reserved image space.
noteEnd
entry renderFrame
module screen ; @mode edit
; @pos 150 100
int8u[] rgba 16 255 0 0 255 0 0 255 128 0 0 0 0 255 255 0 255
int8u[] rgb 18 255 0 0 0 255 0 0 0 255 255 255 0 0 255 255 255 0 255
int8u[] mono 6 0 128 255 255 128 0
int8u[] bits 4 170 128 85 64
int frames 0
push &frames
push frames
push 1
add
store
moduleEnd
entryEnd`;

test.each([false, true])('renders multiple block-bound textures with entry execution enabled=%s', async enabled => {
	const projectSource = enabled
		? source.replace(
				'note views',
				'note config\n; @pos 150 100\n; @config textureRuntime.enabled true\n; @config textureRuntime.entry renderFrame\nnoteEnd\nnote views'
			)
		: source;
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 480;
	document.body.append(canvas);
	const compiler = createCompilerPlugin();
	const load = vi.fn(() =>
		import('@8f4e/editor-plugin-texture-runtime').then(module => module.createTextureRuntimePlugin(compiler))
	);
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
			renderer: new Engine(canvas),
			initialProject: parseProjectSource(projectSource),
			plugins: [
				compiler.plugin,
				createLazyPluginLoaderPlugin([
					{
						id: 'texture-runtime',
						scope: 'project',
						matches: directives =>
							hasConfig(directives, 'textureRuntime') ||
							hasDirective(directives, 'textureUpload') ||
							hasDirective(directives, 'texture'),
						load,
					},
				]),
			],
		});
		editor.pauseRendering();
		await vi.waitFor(
			() => expect(compiler.getCodeBuffer().byteLength, JSON.stringify(compiler.getDiagnostics())).toBeGreaterThan(0),
			{ timeout: 10000 }
		);
		let block = editor.state.project.activeLevel.blocks.find(block => block.name === 'views')!;
		const gl = canvas.getContext('webgl2')!;
		const origin = (name: string) => {
			const line = block.code.findIndex(line => line.includes(`@texture &screen:${name} `));
			return [
				block.x - editor!.state.viewport.x + (block.lineNumberColumnWidth + 2) * editor!.state.viewport.vGrid,
				block.y -
					editor!.state.viewport.y +
					(displayRowToGridRow(block.displayModel.sourceLineIndexToDisplayRow[line], block.gaps) + 1) *
						editor!.state.viewport.hGrid,
			] as const;
		};
		const readPixel = (x: number, y: number) => {
			const pixel = new Uint8Array(4);
			gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
			return [...pixel];
		};
		await vi.waitFor(() => {
			editor!.renderFrame();
			expect(readPixel(...origin('rgba'))).toEqual([255, 0, 0, 255]);
		});
		expect(load).toHaveBeenCalledOnce();
		expect(editor.state.codeErrors['editor-directives']).toEqual([]);
		expect(editor.state.codeErrors.compiler).toEqual([]);
		const framesAddress = editor.state.compiler.result.memoryPlan.modules.screen.memory.frames.allocationUnitAddress;
		const frames = new Int32Array(compiler.getMemory()!.buffer);
		if (enabled)
			await vi.waitFor(() => {
				editor!.renderFrame();
				expect(frames[framesAddress]).toBeGreaterThan(0);
			});
		const before = frames[framesAddress];
		editor.renderFrame();
		expect(frames[framesAddress]).toBe(before + (enabled ? 1 : 0));
		const [bitsX, bitsY] = origin('bits');
		const palette = resolvePalette();
		for (let row = 0; row < 2; row++)
			for (let column = 0; column < 10; column++) {
				const color = (row + column) % 2 === 0 ? palette.rgba.inkBase : palette.rgba.surfaceBase;
				expect(readPixel(bitsX + column * 6, bitsY + row * 6)).toEqual(color.map(value => Math.round(value * 255)));
			}
		const [monoX, monoY] = origin('mono');
		expect(readPixel(monoX + 16, monoY)).toEqual([128, 128, 128, 255]);
		const [rgbX, rgbY] = origin('rgb');
		expect(readPixel(rgbX + 16, rgbY + 16)).toEqual([0, 255, 255, 255]);
		if (enabled) await expect(canvas).toMatchScreenshot('texture-directives');
		const codeBuffer = compiler.getCodeBuffer();
		editor.editing.applyEdits({
			expectedRevision: editor.editing.getRevision(),
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(block),
					code: [
						block.code[0],
						'; @config color.surface #c4c797',
						'; @config color.ink #28362a',
						...block.code.slice(1),
					],
				},
			],
		});
		block = editor.state.project.activeLevel.blocks.find(block => block.name === 'views')!;
		await vi.waitFor(() => {
			editor!.renderFrame();
			const [x, y] = origin('bits');
			expect(readPixel(x, y)).toEqual([40, 54, 42, 255]);
			expect(readPixel(x + 6, y)).toEqual([196, 199, 151, 255]);
		});
		expect(compiler.getCodeBuffer()).toBe(codeBuffer);
		const previous = origin('rgba');
		editor.state.viewport.x += 8;
		editor.state.viewport.y += 16;
		editor.renderFrame();
		expect(origin('rgba')).toEqual([previous[0] - 8, previous[1] - 16]);
		expect(readPixel(...origin('rgba'))).toEqual([255, 0, 0, 255]);
		editor.resize(800, 600);
		editor.releaseRenderingResources();
		editor.resize(640, 480);
		editor.renderFrame();
		expect(readPixel(...origin('rgba'))).toEqual([255, 0, 0, 255]);
		expect(readPixel(...origin('bits'))).toEqual([40, 54, 42, 255]);
		const height = block.height;
		editor.editing.applyEdits({
			expectedRevision: editor.editing.getRevision(),
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(block),
					code: block.code.filter(line => !line.includes('@texture')),
				},
			],
		});
		editor.renderFrame();
		expect(editor.state.project.activeLevel.blocks.find(block => block.name === 'views')!.height).toBeLessThan(height);
		expect(gl.getError()).toBe(gl.NO_ERROR);
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});

const croppedView = '; @texture &screen:rgba 16 1 1 1 1';
const modalTextureSamples = [
	{ directive: '; @texture &screen:rgba 24 2 2', offsetX: 0, color: [255, 0, 0, 255] },
	{ directive: '; @texture &screen:rgb 16 3 2', offsetX: 0, color: [255, 0, 0, 255] },
	{ directive: '; @texture &screen:mono 16 3 2', offsetX: 16, color: [128, 128, 128, 255] },
	{
		directive: '; @texture &screen:bits 6 10 2',
		offsetX: 0,
		color: resolvePalette().rgba.inkBase.map(value => Math.round(value * 255)),
	},
	{ directive: croppedView, offsetX: 0, color: [255, 255, 0, 255] },
];

async function setupModalTextureTest(enabled: boolean) {
	const modalSource = source.replace('Code follows', `${croppedView}\nCode follows`);
	const projectSource = enabled
		? modalSource.replace(
				'note views',
				'note views\n; @config textureRuntime.enabled true\n; @config textureRuntime.entry renderFrame'
			)
		: modalSource;
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 480;
	document.body.append(canvas);
	onTestFinished(() => canvas.remove());
	const compiler = createCompilerPlugin();
	const { createTextureRuntimePlugin } = await import('@8f4e/editor-plugin-texture-runtime');
	let events!: EditorPluginContext['events'];
	const editor = await initEditor(canvas, {
		renderer: new Engine(canvas),
		initialProject: parseProjectSource(projectSource),
		plugins: [
			compiler.plugin,
			dialogsPlugin,
			createTextureRuntimePlugin(compiler),
			{
				id: 'test-events',
				setup: context => {
					events = context.events;
					return () => {};
				},
			},
		],
	});
	onTestFinished(() => editor.dispose());
	editor.pauseRendering();
	await vi.waitFor(() => expect(compiler.getDiagnostics().status).toBe('ready'), { timeout: 10000 });

	const { viewport } = editor.state;
	const block = editor.state.project.activeLevel.blocks.find(block => block.name === 'views')!;
	const gl = canvas.getContext('webgl2')!;
	const readSample = ({ directive, offsetX }: (typeof modalTextureSamples)[number]) => {
		const line = block.code.indexOf(directive);
		const row = displayRowToGridRow(block.displayModel.sourceLineIndexToDisplayRow[line], block.gaps);
		const x = block.x - viewport.x + (block.lineNumberColumnWidth + 2) * viewport.vGrid + offsetX;
		const y = block.y - viewport.y + (row + 1) * viewport.hGrid;
		const pixel = new Uint8Array(4);
		gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
		return [...pixel];
	};
	return { canvas, compiler, editor, events, gl, readSample };
}

test.each([false, true])('hides texture views under modal dialogs with entry execution enabled=%s', async enabled => {
	const { canvas, compiler, editor, events, gl, readSample } = await setupModalTextureTest(enabled);
	const memory = compiler.getMemory()!;
	const codeBuffer = compiler.getCodeBuffer();
	const allocations = editor.state.compiler.result.memoryPlan.modules.screen.memory;
	const frames = new Int32Array(memory.buffer);
	const framesAddress = allocations.frames.allocationUnitAddress;
	const expectedColors = modalTextureSamples.map(sample => sample.color);
	await vi.waitFor(() => {
		editor.renderFrame();
		expect(modalTextureSamples.map(readSample)).toEqual(expectedColors);
		expect(frames[framesAddress] > 0, 'WASM frame counter advances').toBe(enabled);
	});
	const expectHiddenFrame = () => {
		const before = frames[framesAddress];
		editor.renderFrame();
		expect(frames[framesAddress]).toBe(before + Number(enabled));
		for (const sample of modalTextureSamples) expect(readSample(sample), sample.directive).not.toEqual(sample.color);
	};
	for (const id of ['first', 'second']) {
		events.dispatch('addDialog', {
			id,
			title: 'Paused for confirmation',
			text: 'The framebuffer continues updating while this dialog is open.',
			buttons: [],
		});
		expectHiddenFrame();
	}
	events.dispatch('removeDialog', 'second');
	expect(editor.state.dialogStack.map(dialog => dialog.id)).toEqual(['first']);
	expectHiddenFrame();
	if (enabled) await expect(canvas).toMatchScreenshot('dialog-hides-textures');

	const latestColor = [0, 255, 0, 255];
	new Uint8Array(memory.buffer).set(latestColor, allocations.rgba.byteAddress);
	if (enabled) events.dispatch('removeDialog', 'first');
	else events.dispatch('clearDialogs');
	editor.renderFrame();
	expect(modalTextureSamples.map(readSample)).toEqual([latestColor, ...expectedColors.slice(1)]);
	expect(compiler.getMemory()).toBe(memory);
	expect(compiler.getCodeBuffer()).toBe(codeBuffer);
	expect(gl.getError()).toBe(gl.NO_ERROR);
});

test.each([
	['16', 16, 16],
	['16:16', 16, 16],
	['16:32', 16, 32],
	['32:16', 32, 16],
] as const)(
	'shares one upload across direct and cross-module pointer views with magnification %s',
	async (magnification, magnificationX, magnificationY) => {
		const canvas = document.createElement('canvas');
		canvas.width = 768;
		canvas.height = 480;
		document.body.append(canvas);
		const compiler = createCompilerPlugin();
		const { createTextureRuntimePlugin } = await import('@8f4e/editor-plugin-texture-runtime');
		let editor: Editor | undefined;
		try {
			editor = await initEditor(canvas, {
				renderer: new Engine(canvas),
				initialProject: parseProjectSource(`8f4e/v1
constants env
; @pos 150 100
constantsEnd
entry main
module screen ; @mode edit
; @pos 4 3
int8u[] rgba 16
; @textureUpload &rgba rgba 2 2
; @texture &rgba ${magnification} 2 2
moduleEnd
module viewer
; @pos 50 3
int8u* pixels &screen:rgba
; @texture pixels ${magnification} 2 2
moduleEnd
entryEnd`),
				plugins: [compiler.plugin, createTextureRuntimePlugin(compiler)],
			});
			editor.pauseRendering();
			await vi.waitFor(() => expect(compiler.getDiagnostics().status).toBe('ready'), { timeout: 10000 });
			expect(editor.state.codeErrors.compiler).toEqual([]);
			const start = editor.state.compiler.result.memoryPlan.modules.screen.memory.rgba.byteAddress;
			new Uint8Array(compiler.getMemory()!.buffer).set(
				[255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255],
				start
			);
			const gl = canvas.getContext('webgl2')!;
			const allocations = vi.spyOn(gl, 'texImage2D');
			const updates = vi.spyOn(gl, 'texSubImage2D');
			editor.renderFrame();
			editor.renderFrame();
			expect(
				allocations.mock.calls.filter(call => call[2] === gl.RGBA8 && call[3] === 2 && call[4] === 2)
			).toHaveLength(1);
			expect(updates.mock.calls.filter(call => call[4] === 2 && call[5] === 2 && call[6] === gl.RGBA)).toHaveLength(1);
			for (const name of ['screen', 'viewer']) {
				const block = editor.state.project.activeLevel.blocks.find(block => block.name === name)!;
				const line = block.code.findIndex(line => line.includes('@texture '));
				const x = block.x - editor.state.viewport.x + (block.lineNumberColumnWidth + 2) * editor.state.viewport.vGrid;
				const y =
					block.y -
					editor.state.viewport.y +
					(displayRowToGridRow(block.displayModel.sourceLineIndexToDisplayRow[line], block.gaps) + 1) *
						editor.state.viewport.hGrid;
				const width = magnificationX * 2;
				const height = magnificationY * 2;
				const pixels = new Uint8Array(width * height * 4);
				gl.readPixels(x, canvas.height - y - height, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
				const colors = [
					[255, 0, 0, 255],
					[0, 255, 0, 255],
					[0, 0, 255, 255],
					[255, 255, 255, 255],
				];
				for (let row = 0; row < height; row++)
					for (let column = 0; column < width; column++) {
						const offset = ((height - 1 - row) * width + column) * 4;
						expect([...pixels.subarray(offset, offset + 4)], `${name}, ${column},${row}`).toEqual(
							colors[Math.floor(row / magnificationY) * 2 + Math.floor(column / magnificationX)]
						);
					}
			}
			if (magnification === '16:32') await expect(canvas).toMatchScreenshot('stretched-texture-directives');
			expect(gl.getError()).toBe(gl.NO_ERROR);
		} finally {
			editor?.dispose();
			canvas.remove();
			vi.restoreAllMocks();
		}
	}
);
