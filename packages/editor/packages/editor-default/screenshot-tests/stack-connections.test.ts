import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initEditor, { type EditorPluginContext } from '@8f4e/editor-core';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { stackConnectionsPlugin } from '@8f4e/editor-plugin-stack-connections';
import { stackProducersPlugin } from '@8f4e/editor-plugin-stack-producers';
import { expect, test } from 'vitest';

test('connects operand producers across inline layout gaps and follows the selected instruction', async () => {
	const project = parseProjectSource(`8f4e/v1
entry main
module example
; @pos 6 3
push 2
push 3
add
push 7
push 1
if
push 11
else
push 13
ifEnd int
call sum3
drop
moduleEnd
entryEnd
function sum3
param int a
param int b
param int c
push a
push b
add
push c
add
functionEnd int`);
	const compiled = await compileProject(project, { includeStackAnalysis: true });
	const canvas = document.createElement('canvas');
	canvas.width = 432;
	canvas.height = 320;
	document.body.append(canvas);
	let context!: EditorPluginContext;
	const editor = await initEditor(canvas, {
		initialProject: project,
		plugins: [
			codeBlockBackgroundPlugin,
			codeRenderingPlugin,
			stackProducersPlugin,
			stackConnectionsPlugin,
			{
				id: 'capture-context',
				setup: services => {
					context = services;
					return () => {};
				},
			},
		],
	});
	editor.pauseRendering();
	try {
		const { store, layout } = context;
		const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'example')!;
		store.set('codeBlockRendering.currentProject.blocks', [block]);
		store.set('compiler.result', { ...compiled, inputRevision: editor.state.compilerInputRevision });
		store.set('codeBlockRendering.selectedCodeBlock', block);
		const select = (instruction: string) =>
			store.set('codeBlockRendering.selectedCodeBlock.cursor.row', block.code.indexOf(instruction));
		select('call sum3');
		const contribution = layout.createContribution();
		try {
			contribution.update(block, {
				verticalSpaceAfterSourceLine: [{ sourceLineIndex: block.code.indexOf('push 7'), heightInRows: 1 }],
			});
			editor.renderFrame();
			await expect(canvas).toMatchScreenshot('three-producers-with-gap');

			select('push 2');
			editor.renderFrame();
			await expect(canvas).toMatchScreenshot('instruction-without-producers');
		} finally {
			contribution.dispose();
		}
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
