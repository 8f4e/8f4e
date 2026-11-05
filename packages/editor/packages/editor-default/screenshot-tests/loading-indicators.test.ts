import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPlugin, type EditorPluginContext } from '@8f4e/editor-core';
import { createBinaryAssetsPlugin } from '@8f4e/editor-plugin-binary-assets';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { createDeferredPluginLoaderPlugin, createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { loadingIndicatorsPlugin } from '@8f4e/editor-plugin-loading-indicators';
import { expect, test, vi } from 'vitest';

test('shows concurrent plugin and asset loads without blocking the editor', async () => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
	const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 320;
	canvas.style.width = '512px';
	canvas.style.height = '320px';
	document.body.append(canvas);
	const project = parseProjectSource(`8f4e/v1
constants env
; @pos 80 40
constantsEnd
note config
; @pos 80 50
; @config bin.sound.url https://example.com/sound.pcm
; @config bin.sound.memory player:buffer
; @config bin.missing.url https://example.com/missing.pcm
; @config bin.missing.memory player:buffer
noteEnd
entry main
module player
; @pos 4 3
int[] buffer 4
moduleEnd
entryEnd`);
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const memory = new Uint8Array(65536);
	let finishAsset!: (response: Response) => void;
	let failAsset!: (error: Error) => void;
	const fetchAsset = vi.fn(
		(url: string) =>
			new Promise<Response>((resolve, reject) => {
				if (url.endsWith('sound.pcm')) finishAsset = resolve;
				else failAsset = reject;
			})
	);
	vi.stubGlobal('fetch', fetchAsset);
	vi.stubGlobal('caches', undefined);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	let finishPlugin!: (plugin: EditorPlugin) => void;
	const pendingPlugin = new Promise<EditorPlugin>(resolve => {
		finishPlugin = resolve;
	});
	let context!: EditorPluginContext;
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
			initialProject: project,
			plugins: [
				codeBlockBackgroundPlugin,
				codeRenderingPlugin,
				loadingIndicatorsPlugin,
				createBinaryAssetsPlugin({ getMemoryBytes: () => memory }),
				createLazyPluginLoaderPlugin([
					{ id: 'plot plugin', scope: 'view', matches: () => true, load: () => pendingPlugin },
				]),
				{
					id: 'test-context',
					setup: services => {
						context = services;
						return () => {};
					},
				},
			],
		});
		expect(editor.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
			{ id: 'plugin:plot plugin', message: 'Loading plot plugin...', status: 'loading' },
			{ id: 'asset:sound', message: 'Loading sound...', status: 'loading' },
			{ id: 'asset:missing', message: 'Loading missing...', status: 'loading' },
		]);
		expect(editor.state.dialogStack).toEqual([]);
		editor.pauseRendering();
		now.mockReturnValue(1240);
		vi.advanceTimersByTime(100);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('loading-indicators-pending');
		const previousX = editor.state.viewport.x;
		context.events.dispatch('pointermove', { buttons: 1, movementX: 16, movementY: 0 });
		expect(editor.state.viewport.x).toBe(previousX - 16);
		context.store.set('compiler.result.compiledModules', compiled.compiledModules);
		context.store.set('compiler.result.memoryPlan', compiled.memoryPlan);
		now.mockReturnValue(1760);
		finishAsset(new Response(new Uint8Array([1, 2, 3, 4])));
		await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalledTimes(2));
		failAsset(new Error('offline'));
		await vi.waitFor(() =>
			expect(editor!.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
				{ id: 'plugin:plot plugin', message: 'Loading plot plugin...', status: 'loading' },
			])
		);
		const target = compiled.memoryPlan.modules.player.memory.buffer;
		expect([...memory.slice(target.byteAddress, target.byteAddress + 4)]).toEqual([1, 2, 3, 4]);
		now.mockReturnValue(2350);
		finishPlugin({ id: 'plot plugin', setup: () => () => {} });
		await vi.waitFor(() =>
			expect(editor!.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([])
		);
		expect(editor.state.loadingIndicators.map(indicator => indicator.status)).toEqual(['done', 'done', 'failed']);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('loading-indicators-finished');
	} finally {
		editor?.dispose();
		canvas.remove();
		vi.unstubAllGlobals();
		vi.useRealTimers();
		vi.restoreAllMocks();
	}
});

test('shows the initial deferred import through an eagerly installed loading drawer', async () => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
	const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 160;
	canvas.style.width = '512px';
	canvas.style.height = '160px';
	document.body.append(canvas);
	let finish!: (plugin: EditorPlugin) => void;
	const pending = new Promise<EditorPlugin>(resolve => {
		finish = resolve;
	});
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
			plugins: [loadingIndicatorsPlugin, createDeferredPluginLoaderPlugin({ load: () => pending })],
		});
		expect(editor.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
			{ id: 'editor-plugins', message: 'Loading editor plugins...', status: 'loading' },
		]);
		editor.pauseRendering();
		now.mockReturnValue(1240);
		vi.advanceTimersByTime(100);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('initial-editor-plugins-loading');
		finish({ id: 'features', setup: () => () => {} });
		await vi.waitFor(() =>
			expect(editor!.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([])
		);
	} finally {
		editor?.dispose();
		canvas.remove();
		vi.useRealTimers();
		vi.restoreAllMocks();
	}
});
