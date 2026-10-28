import initEditor, { type Editor } from '@8f4e/editor-core';
import { expect, test, vi } from 'vitest';
import { createProjectUrlLoaderPlugin } from '../src/index';

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
			initialEditorMode: 'edit',
			runtimeRegistry: {},
			plugins: [createProjectUrlLoaderPlugin({ fetch, initialProjectUrl: 'https://example.com/project.8f4e' })],
		});
		await vi.waitFor(() =>
			expect(
				editor!.state.codeBlockRendering.codeBlocks.some(block =>
					block.code.includes('Loaded from an explicit project URL.')
				)
			).toBe(true)
		);
		expect(fetch).toHaveBeenCalledWith('https://example.com/project.8f4e', { cache: 'no-store' });
		editor.pauseRendering();
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('loaded-project-url');
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
