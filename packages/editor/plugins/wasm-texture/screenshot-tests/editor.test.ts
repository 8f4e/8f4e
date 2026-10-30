import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor } from '@8f4e/editor-core';
import { createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createLazyPluginLoaderPlugin, hasConfig } from '@8f4e/editor-plugin-lazy-loader';
import { expect, test, vi } from 'vitest';

const source = `8f4e/v1
constants env
; @pos 100 100
constantsEnd
note picture
; @pos 4 3
RGBA8 pixels from WebAssembly.
Nearest sampling and per-pixel alpha.
noteEnd
note config
; @pos 100 100
; @config wasmTexture.target screen:rgba
; @config wasmTexture.width 2
; @config wasmTexture.height 2
; @config wasmTexture.magnification 64
; @config wasmTexture.position right
noteEnd
entry main
module screen
; @pos 100 100
int8u[] rgba 16 255 0 0 255 0 0 255 128 0 0 0 0 255 255 0 255
moduleEnd
entryEnd`;

test('loads from raw config and renders compiled pixels through resize and resource restoration', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 360;
	canvas.style.width = '640px';
	canvas.style.height = '360px';
	document.body.append(canvas);
	const compiler = createCompilerPlugin();
	const load = vi.fn(() => import('../src/index').then(module => module.createWasmTexturePlugin(compiler)));
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
			initialProject: parseProjectSource(source),
			plugins: [
				compiler.plugin,
				createLazyPluginLoaderPlugin([
					{ id: 'wasm-texture', scope: 'project', matches: directives => hasConfig(directives, 'wasmTexture'), load },
				]),
			],
			featureFlags: { modeOverlay: false, offscreenBlockArrows: false },
		});
		editor.pauseRendering();
		await vi.waitFor(
			() => expect(compiler.getCodeBuffer().byteLength, JSON.stringify(compiler.getDiagnostics())).toBeGreaterThan(0),
			{ timeout: 10000 }
		);
		expect(editor.state.codeErrors.compilationErrors).toEqual([]);
		const address = editor.state.compiler.memoryPlan.modules.screen.memory.rgba.byteAddress;
		expect([...new Uint8Array(compiler.getMemory()!.buffer, address, 4)]).toEqual([255, 0, 0, 255]);
		const gl = canvas.getContext('webgl2')!;
		const readRed = (x: number, y: number) => {
			const pixel = new Uint8Array(4);
			gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
			expect([...pixel]).toEqual([255, 0, 0, 255]);
		};
		await vi.waitFor(() => {
			editor!.renderFrame();
			readRed(420, 120);
		});
		expect(load).toHaveBeenCalledOnce();
		expect(editor.state.codeErrors.editorDirectiveErrors).toEqual([]);
		editor.resize(800, 400);
		readRed(540, 140);
		editor.releaseRenderingResources();
		editor.resize(640, 360);
		editor.renderFrame();
		readRed(420, 120);
		await expect(canvas).toMatchScreenshot('wasm-texture');
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
