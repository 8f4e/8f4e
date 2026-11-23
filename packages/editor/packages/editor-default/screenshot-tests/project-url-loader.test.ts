import initEditor, { type Editor } from '@8f4e/editor-core';
import { mountDefaultEditor } from '@8f4e/editor-default';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import { serializeToProject } from '@8f4e/editor-state';
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
		'8f4e/v1\nconstants env\n; @pos 120 60\nconstantsEnd\nnote remote\n; @pos 3 10\nLoaded from an explicit project URL.\nnoteEnd';
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
		expect(serializeToProject(editor.state)).toMatchObject({ entries: [], execution: [], notes: [] });
		expect(editor.state.gridSizeReady).toBe(true);
		expect(editor.state.console.logs.some(log => log.message.includes('Failed to load project'))).toBe(true);
		expect(editor.state.loadingIndicators.find(indicator => indicator.id === 'project-url')?.status).toBe('failed');
	} finally {
		editor?.dispose();
		sessionStorage.removeItem(`project_${storageNamespace}`);
		canvas.remove();
	}
});
