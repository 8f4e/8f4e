import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initEditor, { type EditorPluginContext } from '@8f4e/editor-core';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { stackProducersPlugin } from '@8f4e/editor-plugin-stack-producers';
import { expect, test } from 'vitest';

test('highlights immediate producers above nested shading and below instruction text', async () => {
	const project = parseProjectSource(`8f4e/v1
entry main
module example
; @pos 4 3
push 2
push 3
add
push 1
if
push 4
else
push 5
ifEnd int
mul
drop
moduleEnd
entryEnd`);
	const compiled = await compileProject(project, { includeStackAnalysis: true });
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 400;
	document.body.append(canvas);
	let context: EditorPluginContext;
	const editor = await initEditor(canvas, {
		plugins: [
			codeBlockBackgroundPlugin,
			codeRenderingPlugin,
			stackProducersPlugin,
			{
				id: 'fixture',
				setup: value => {
					context = value;
					return () => {};
				},
			},
		],
		initialProject: project,
	});
	editor.pauseRendering();
	try {
		const { store, layout } = context!;
		const visible = editor.state.codeBlockRendering.currentProject.blocks.filter(block => block.name === 'example');
		store.set('codeBlockRendering.currentProject.blocks', visible);
		const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'example')!;
		store.set('compiler.result', {
			...compiled,
			inputRevision: editor.state.compilerInputRevision,
		});
		store.set('codeBlockRendering.selectedCodeBlock', block);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 11);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('conditional-result-producers');
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 4);
		const contribution = layout.createContribution();
		contribution.update(block, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 2, heightInRows: 1 }] });
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('arithmetic-producers-with-gap');
		contribution.dispose();
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
