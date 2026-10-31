import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, getEditorBlockId } from '@8f4e/editor-core';
import { createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createLazyPluginLoaderPlugin, hasConfig, hasDirective } from '@8f4e/editor-plugin-lazy-loader';
import { gapCalculator } from '@8f4e/editor-state';
import { expect, test, vi } from 'vitest';

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
	const load = vi.fn(() => import('../src/index').then(module => module.createTextureRuntimePlugin(compiler)));
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
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
			featureFlags: { modeOverlay: false, offscreenBlockArrows: false },
		});
		editor.pauseRendering();
		await vi.waitFor(
			() => expect(compiler.getCodeBuffer().byteLength, JSON.stringify(compiler.getDiagnostics())).toBeGreaterThan(0),
			{ timeout: 10000 }
		);
		const block = editor.state.codeBlockRendering.codeBlocks.find(block => block.name === 'views')!;
		const gl = canvas.getContext('webgl2')!;
		const origin = (name: string) => {
			const line = block.code.findIndex(line => line.includes(`@texture &screen:${name} `));
			return [
				block.x - editor!.state.viewport.x + (block.lineNumberColumnWidth + 2) * editor!.state.viewport.vGrid,
				block.y -
					editor!.state.viewport.y +
					(gapCalculator(block.displayModel.sourceLineIndexToDisplayRow[line], block.gaps) + 1) *
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
		expect(editor.state.codeErrors.editorDirectiveErrors).toEqual([]);
		expect(editor.state.codeErrors.compilationErrors).toEqual([]);
		const framesAddress = editor.state.compiler.memoryPlan.modules.screen.memory.frames.allocationUnitAddress;
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
		for (let row = 0; row < 2; row++)
			for (let column = 0; column < 10; column++) {
				const value = (row + column) % 2 === 0 ? 255 : 0;
				expect(readPixel(bitsX + column * 6, bitsY + row * 6)).toEqual([value, value, value, 255]);
			}
		const [monoX, monoY] = origin('mono');
		expect(readPixel(monoX + 16, monoY)).toEqual([128, 128, 128, 255]);
		const [rgbX, rgbY] = origin('rgb');
		expect(readPixel(rgbX + 16, rgbY + 16)).toEqual([0, 255, 255, 255]);
		if (enabled) await expect(canvas).toMatchScreenshot('texture-directives');
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
		expect(editor.state.codeBlockRendering.codeBlocks.find(block => block.name === 'views')!.height).toBeLessThan(
			height
		);
		expect(gl.getError()).toBe(gl.NO_ERROR);
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});

test('shares one upload per frame across direct and cross-module pointer views', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 480;
	document.body.append(canvas);
	const compiler = createCompilerPlugin();
	const { createTextureRuntimePlugin } = await import('../src/index');
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
			initialProject: parseProjectSource(`8f4e/v1
constants env
; @pos 150 100
constantsEnd
entry main
module screen ; @mode edit
; @pos 4 3
int8u[] rgba 16
; @textureUpload &rgba rgba 2 2
; @texture &rgba 16 2 2
moduleEnd
module viewer
; @pos 50 3
int8u* pixels &screen:rgba
; @texture pixels 16 2 2
moduleEnd
entryEnd`),
			plugins: [compiler.plugin, createTextureRuntimePlugin(compiler)],
		});
		editor.pauseRendering();
		await vi.waitFor(() => expect(compiler.getDiagnostics().status).toBe('ready'), { timeout: 10000 });
		expect(editor.state.codeErrors.compilationErrors).toEqual([]);
		const start = editor.state.compiler.memoryPlan.modules.screen.memory.rgba.byteAddress;
		new Uint8Array(compiler.getMemory()!.buffer).set(
			[255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255],
			start
		);
		const gl = canvas.getContext('webgl2')!;
		const allocations = vi.spyOn(gl, 'texImage2D');
		const updates = vi.spyOn(gl, 'texSubImage2D');
		editor.renderFrame();
		editor.renderFrame();
		expect(allocations.mock.calls.filter(call => call[2] === gl.RGBA8 && call[3] === 2 && call[4] === 2)).toHaveLength(
			1
		);
		expect(updates.mock.calls.filter(call => call[4] === 2 && call[5] === 2 && call[6] === gl.RGBA)).toHaveLength(1);
		for (const name of ['screen', 'viewer']) {
			const block = editor.state.codeBlockRendering.codeBlocks.find(block => block.name === name)!;
			const line = block.code.findIndex(line => line.includes('@texture '));
			const x = block.x - editor.state.viewport.x + (block.lineNumberColumnWidth + 2) * editor.state.viewport.vGrid;
			const y =
				block.y -
				editor.state.viewport.y +
				(gapCalculator(block.displayModel.sourceLineIndexToDisplayRow[line], block.gaps) + 1) *
					editor.state.viewport.hGrid;
			const pixel = new Uint8Array(4);
			gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
			expect([...pixel], name).toEqual([255, 0, 0, 255]);
		}
		expect(gl.getError()).toBe(gl.NO_ERROR);
	} finally {
		editor?.dispose();
		canvas.remove();
		vi.restoreAllMocks();
	}
});
