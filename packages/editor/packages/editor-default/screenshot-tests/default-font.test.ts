import { type Editor, getEditorBlockId } from '@8f4e/editor-core';
import { mountDefaultEditor } from '@8f4e/editor-default';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import { expect, test } from 'vitest';
import { cdp } from 'vitest/browser';

test('uses PixelCode on coarse pointers and restores it after a project font override', async () => {
	const input = cdp();
	await input.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
	const canvas = document.createElement('canvas');
	canvas.width = 390;
	canvas.height = 240;
	document.body.append(canvas);
	const code = [
		'note mobile',
		'; @mode edit',
		'; @pos 3 3',
		'PixelCode 6x12',
		'Numbers: 0123456789',
		'Code: [] {} () +-*/',
		'CP437: é Ç ß α Ω ░▒▓█',
		'noteEnd',
	];
	const initialProjectUrl = `data:text/plain,${encodeURIComponent(`8f4e/v1\n${code.join('\n')}`)}`;
	let editor: Editor | undefined;
	try {
		expect(window.matchMedia('(pointer: coarse)').matches).toBe(true);
		editor = await mountDefaultEditor(canvas, {
			storage: {} as Storage,
			initialProjectUrl,
			plugins: [
				createProjectUrlLoaderPlugin({ fetch: globalThis.fetch, initialProjectUrl }),
				codeBlockBackgroundPlugin,
				codeRenderingPlugin,
			],
		});
		editor.pauseRendering();
		expect(editor.state.viewport).toMatchObject({ vGrid: 6, hGrid: 12 });
		expect(editor.state.editorConfig.font).toBeUndefined();
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('mobile-pixelcode-default');
		const block = editor.state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'mobile')!;
		const blockId = getEditorBlockId(block);
		editor.editing.applyEdits({
			expectedRevision: editor.editing.getRevision(),
			edits: [{ type: 'update', blockId, code: [code[0], '; @config font ibmvga8x16', ...code.slice(1)] }],
		});
		await expect.poll(() => editor!.state.viewport.vGrid).toBe(8);
		expect(editor.state.viewport.hGrid).toBe(16);
		editor.editing.applyEdits({
			expectedRevision: editor.editing.getRevision(),
			edits: [{ type: 'update', blockId, code }],
		});
		await expect.poll(() => editor!.state.viewport.hGrid).toBe(12);
		expect(editor.state.viewport.vGrid).toBe(6);
		expect(editor.state.editorConfig.font).toBeUndefined();
	} finally {
		editor?.dispose();
		canvas.remove();
		await input.send('Emulation.setTouchEmulationEnabled', { enabled: false });
	}
});
