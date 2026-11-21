import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { getEditorBlockId } from '@8f4e/editor-core';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { errorMessagesPlugin } from '@8f4e/editor-plugin-error-messages';
import { createScopePlugin } from '@8f4e/editor-plugin-scope';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';

test('shows a code error for an unsupported scope rate and clears it after a source edit', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 320;
	document.body.append(canvas);
	const editor = await initEditor(canvas, {
		renderer: new Engine(canvas),
		initialProject: parseProjectSource(`8f4e/v1
constants env
; @pos 120 60
constantsEnd
entry main
module audio
; @pos 4 3
float signal 0
; @scope signal 500 -1 1
moduleEnd
entryEnd`),
		plugins: [
			codeBlockBackgroundPlugin,
			codeRenderingPlugin,
			errorMessagesPlugin,
			createScopePlugin({ getMemory: () => null }),
		],
	});
	editor.pauseRendering();
	try {
		const block = () => editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'audio')!;
		expect(editor.state.codeErrors.scope).toEqual([
			{
				codeBlockId: block().creationIndex,
				lineNumber: 3,
				message: '@scope: sample rate must not exceed 250 Hz.',
			},
		]);
		expect(block().gaps.get(3)?.size).toBeGreaterThan(0);
		editor.state.viewport.x = 0;
		editor.state.viewport.y = 0;
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('scope-rate-error');

		editor.state.editorMode = 'edit';
		editor.editing.applyEdits({
			expectedRevision: editor.editing.getRevision(),
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(block()),
					code: block().code.map(line => line.replace('500', '250')),
				},
			],
		});
		expect(editor.state.codeErrors.scope).toEqual([]);
		expect(block().gaps.get(3)?.size).toBe(8);
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
