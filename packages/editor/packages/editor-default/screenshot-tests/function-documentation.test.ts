import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initEditor, { type EditorPluginContext } from '@8f4e/editor-core';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { dottedBackgroundPlugin } from '@8f4e/editor-plugin-dotted-background';
import { tooltipsPlugin } from '@8f4e/editor-plugin-tooltips';
import lerpSource from '@8f4e/stdlib/std/math/lerp.8f4e?raw';
import { Engine } from 'glugglugglug';
import { expect, test, vi } from 'vitest';

test('shows the resolved standard-library documentation beside a call', async () => {
	const project = parseProjectSource(`8f4e/v1
includes
include std/math/lerp
includesEnd
entry main
module example
; @pos 44 4
call lerp 0.0 1.0 0.5
drop
moduleEnd
entryEnd`);
	const compiled = await compileProject(project, {
		includeStackAnalysis: true,
		resolveInclude: id => (id === 'std/math/lerp' ? lerpSource : undefined),
	});
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 400;
	document.body.append(canvas);
	let context!: EditorPluginContext;
	const editor = await initEditor(canvas, {
		renderer: new Engine(canvas),
		initialProject: project,
		featureFlags: { codeLineSelection: true },
		plugins: [
			dottedBackgroundPlugin,
			codeBlockBackgroundPlugin,
			codeRenderingPlugin,
			tooltipsPlugin,
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
	const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
	try {
		const { store } = context;
		const block = editor.state.project.activeLevel.blocks.find(block => block.name === 'example')!;
		store.set('project.activeLevel.blocks', [block]);
		store.set('compiler.result', { ...compiled, inputRevision: editor.state.compilerInputRevision });
		store.set('project.selectedCodeBlock', block);
		store.set(
			'project.selectedCodeBlock.cursor.row',
			block.code.findIndex(line => line.startsWith('call '))
		);
		store.set('viewport.x', 0);
		store.set('viewport.y', 0);
		now.mockReturnValue(2000);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('documented-stdlib-call');
	} finally {
		now.mockRestore();
		editor.dispose();
		canvas.remove();
	}
});
