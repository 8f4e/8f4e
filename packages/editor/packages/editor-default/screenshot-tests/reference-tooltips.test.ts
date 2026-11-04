import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPluginContext } from '@8f4e/editor-core';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { tooltipsPlugin } from '@8f4e/editor-plugin-tooltips';
import { expect, test, vi } from 'vitest';

test.each([
	{ name: 'fixed-reference', declaration: 'float&' },
	{ name: 'allocated-pointer', declaration: 'float*' },
])('inspects a $name beside the other declaration', async ({ name, declaration }) => {
	const canvas = document.createElement('canvas');
	canvas.width = 800;
	canvas.height = 400;
	document.body.append(canvas);
	const compiler = createCompilerPlugin();
	let context!: EditorPluginContext;
	let editor: Editor | undefined;
	let now: ReturnType<typeof vi.spyOn> | undefined;
	try {
		editor = await initEditor(canvas, {
			initialProject: parseProjectSource(`8f4e/v1
constants env
; @pos 150 100
constantsEnd
entry main
module source
; @pos 50 15
float[] output 2 1.5 2.5
moduleEnd
module inspect
; @pos 50 4
float& input &source:output
float* pointer &source:output
moduleEnd
entryEnd`),
			featureFlags: { offscreenBlockArrows: false },
			plugins: [
				compiler.plugin,
				codeBlockBackgroundPlugin,
				codeRenderingPlugin,
				tooltipsPlugin,
				{
					id: 'test-context',
					setup: services => {
						context = services;
						return () => {};
					},
				},
			],
		});
		editor.pauseRendering();
		await expect.poll(() => compiler.getMemory(), { timeout: 10000 }).not.toBeNull();
		expect(compiler.getDiagnostics()?.compilationErrors).toEqual([]);
		const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'inspect')!;
		now = vi.spyOn(performance, 'now').mockReturnValue(0);
		context.store.set('editorMode', 'edit');
		context.store.set('codeBlockRendering.selectedCodeBlock', block);
		context.store.set(
			'codeBlockRendering.selectedCodeBlock.cursor.row',
			block.code.findIndex(line => line.startsWith(declaration))
		);
		editor.state.viewport.x = 0;
		editor.state.viewport.y = 0;
		now.mockReturnValue(1000);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot(name);
	} finally {
		now?.mockRestore();
		editor?.dispose();
		canvas.remove();
	}
});
