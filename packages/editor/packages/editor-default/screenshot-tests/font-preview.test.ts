import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPluginContext, getEditorBlockId } from '@8f4e/editor-core';
import { createDefaultEditorPlugins } from '@8f4e/editor-default';
import { serializeToProject } from '@8f4e/editor-state';
import { expect, test } from 'vitest';

test('previews fonts through the default composition without changing saved source', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 256;
	document.body.append(canvas);
	const project = parseProjectSource(
		'8f4e/v1\nconstants env\n; @pos 120 60\nconstantsEnd\nnote settings\n; @mode edit\n; @pos 3 3\n; @config font spleen16x32\nSample text\nnoteEnd'
	);
	let editor: Editor | undefined;
	let context!: EditorPluginContext;
	try {
		const plugins = await createDefaultEditorPlugins({
			canvas,
			storage: { getItem: () => null, setItem: () => {} } as Storage,
			storageKey: 'font-preview-test',
			showOpenMenuItem: false,
			renderFrame: () => editor!.renderFrame(),
			getMemory: () => null,
			writeMemory: () => {},
			getCodeBuffer: () => new Uint8Array(),
			getAssertionSites: () => undefined,
		});
		editor = await initEditor(canvas, {
			initialProject: project,
			plugins: [
				...plugins,
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
		const source = serializeToProject(editor.state);
		const revision = editor.editing.getRevision();
		const key = (key: string) => {
			const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
			canvas.dispatchEvent(event);
			return event;
		};
		await expect.poll(() => editor!.state.viewport.vGrid).toBe(16);
		expect(key('F19').defaultPrevented).toBe(true);
		await expect.poll(() => editor!.state.viewport.vGrid).toBe(6);
		expect(editor.state.viewport.hGrid).toBe(10);
		expect(serializeToProject(editor.state)).toEqual(source);
		expect(editor.editing.getRevision()).toBe(revision);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('font-preview');
		const block = editor.state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'settings')!;
		editor.editing.applyEdits({
			expectedRevision: revision,
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(block),
					code: block.code.map(line => line.replace('spleen16x32', 'terminus10x18')),
				},
			],
		});
		expect(editor.state.editorConfig.font).toBe('6x10');
		context.events.dispatch('loadProject', { project });
		await expect.poll(() => editor!.state.viewport.vGrid).toBe(16);
		expect(editor.state.editorConfig.font).toBe('spleen16x32');
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
