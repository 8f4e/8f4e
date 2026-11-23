import initEditor, { type Editor } from '@8f4e/editor-core';
import { mountDefaultEditor } from '@8f4e/editor-default';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import { createAsciiCanvasRenderer, readAsciiViewport } from '@8f4e/web-ui-testing';
import { expect, test, vi } from 'vitest';

test('loads an initial project URL after generic editor startup', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 320;
	canvas.style.width = '640px';
	canvas.style.height = '320px';
	document.body.appendChild(canvas);
	const source =
		'8f4e/v1\nconstants env\n; @pos 120 60\nconstantsEnd\nnote remote\n; @pos 3 3\nLoaded from an explicit project URL.\nnoteEnd';
	const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(source));
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
			renderer: createAsciiCanvasRenderer(canvas),
			plugins: [
				codeRenderingPlugin,
				createProjectUrlLoaderPlugin({ fetch, initialProjectUrl: 'https://example.com/project.8f4e' }),
			],
		});
		await vi.waitFor(() =>
			expect(
				editor!.state.codeBlockRendering.currentProject.blocks.some(block =>
					block.code.includes('Loaded from an explicit project URL.')
				)
			).toBe(true)
		);
		expect(fetch).toHaveBeenCalledWith('https://example.com/project.8f4e', { cache: 'no-store' });
		editor.state.editorMode = 'edit';
		editor.pauseRendering();
		editor.renderFrame();
		await expect(readAsciiViewport(canvas)).toMatchFileSnapshot('./__snapshots__/loaded-project-url.viewport.snap');
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});

test('rejects a required URL load before installing an atlas or drawing a frame', async () => {
	const canvas = document.createElement('canvas');
	document.body.appendChild(canvas);
	const renderer = createAsciiCanvasRenderer(canvas);
	const destroy = vi.spyOn(renderer, 'destroy');
	const installAtlas = vi.spyOn(renderer, 'setSpriteAtlas');
	const drawFrame = vi.spyOn(renderer, 'renderFrame');
	const error = new Error('Offline');
	const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(error);
	let editor: Editor | undefined;
	try {
		const mounting = initEditor(canvas, {
			renderer,
			plugins: [createProjectUrlLoaderPlugin({ fetch, initialProjectUrl: 'https://example.com/project.8f4e' })],
		}).then(result => {
			editor = result;
			return result;
		});
		await expect(mounting).rejects.toBe(error);
		expect(installAtlas).not.toHaveBeenCalled();
		expect(drawFrame).not.toHaveBeenCalled();
		expect(destroy).toHaveBeenCalledOnce();
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});

test('mounts an editable empty default editor after its initial URL fails', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 320;
	document.body.appendChild(canvas);
	const storageNamespace = 'failed-project-url-test';
	let editor: Editor | undefined;
	try {
		editor = await mountDefaultEditor(canvas, {
			storage: sessionStorage,
			storageNamespace,
			initialProjectUrl: 'data:text/plain,invalid%20project',
		});
		editor.pauseRendering();
		expect(editor.state.initialProjectState).toMatchObject({ entries: [], execution: [], notes: [] });
		expect(editor.state.gridSizeReady).toBe(true);
		expect(editor.state.console.logs.some(log => log.message.includes('Failed to load project'))).toBe(true);
		expect(editor.state.loadingIndicators.find(indicator => indicator.id === 'project-url')?.status).toBe('failed');
	} finally {
		editor?.dispose();
		sessionStorage.removeItem(`project_${storageNamespace}`);
		canvas.remove();
	}
});
