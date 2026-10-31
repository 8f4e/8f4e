import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPluginContext } from '@8f4e/editor-core';
import { expect, test, vi } from 'vitest';
import { createBinaryAssetsPlugin } from '../src/index';

test('shows the loading dialog, loads bytes, and publishes size constants', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 384;
	canvas.style.width = '768px';
	canvas.style.height = '384px';
	document.body.appendChild(canvas);
	const project = parseProjectSource(`8f4e/v1
constants env
; @pos 4 2
constantsEnd
note config
; @pos 4 40
; @config bin.sound.url https://example.com/sample.pcm
; @config bin.sound.memory player:buffer
noteEnd
entry main
module player
; @pos 60 2
int[] buffer 4
moduleEnd
entryEnd`);
	const compiled = await compileProject(project, { disableSharedMemory: true });
	let finish!: (response: Response) => void;
	vi.stubGlobal(
		'fetch',
		vi.fn(
			() =>
				new Promise<Response>(resolve => {
					finish = resolve;
				})
		)
	);
	vi.stubGlobal('caches', undefined);
	let memory: Uint8Array | undefined;
	let store!: EditorPluginContext['store'];
	const plugin = createBinaryAssetsPlugin({ getMemoryBytes: () => memory });
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
			initialProject: project,
			plugins: [
				{
					...plugin,
					setup: context => {
						store = context.store;
						return plugin.setup(context);
					},
				},
			],
		});
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
		await vi.waitFor(() => expect(editor!.state.dialog.id).toBe('binary-assets-loading'));
		editor.pauseRendering();
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('binary-assets-loading');
		memory = new Uint8Array(65536);
		store.set('compiler.result.compiledModules', compiled.compiledModules);
		store.set('compiler.result.memoryDefaultsByModuleId', compiled.memoryDefaultsByModuleId);
		store.set('compiler.result.memoryPlan', compiled.memoryPlan);
		finish(new Response(new Uint8Array([1, 2, 3, 4, 5, 6])));
		await vi.waitFor(() => expect(editor!.state.dialogStack).toEqual([]));
		const target = compiled.memoryPlan.modules.player.memory.buffer;
		expect([...memory.slice(target.byteAddress, target.byteAddress + 6)]).toEqual([1, 2, 3, 4, 5, 6]);
		expect(editor.state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'env')?.code).toContain(
			'const ASSET_SOUND_SIZE 6'
		);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('binary-assets-loaded');
	} finally {
		editor?.dispose();
		canvas.remove();
		vi.unstubAllGlobals();
	}
});
