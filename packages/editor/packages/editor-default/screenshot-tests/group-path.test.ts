import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPluginContext, getEditorBlockId } from '@8f4e/editor-core';
import { createDefaultEditorPlugins } from '@8f4e/editor-default';
import { expect, test, vi } from 'vitest';

const source = `8f4e/v1
constants env
; @pos 120 60
constantsEnd
entry main
group audio
; @pos 4 5
entry main
group voices
; @pos 4 5
entry main
group envelope
; @pos 4 5
entry main
module attack
; @pos 4 5
int level 0
moduleEnd
entryEnd
groupEnd
entryEnd
groupEnd
entryEnd
groupEnd
entryEnd`;

test('shows the active group ancestry below the mode hint as the editor moves through groups', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 480;
	canvas.height = 192;
	document.body.append(canvas);
	let editor: Editor | undefined;
	let context!: EditorPluginContext;
	try {
		const plugins = createDefaultEditorPlugins({
			canvas,
			storage: { getItem: () => null, setItem: () => {} } as Storage,
			storageKey: 'group-path-test',
			showOpenMenuItem: false,
			renderFrame: () => editor!.renderFrame(),
			getMemory: () => null,
			writeMemory: () => {},
			getCodeBuffer: () => new Uint8Array(),
			getAssertionSites: () => undefined,
		});
		const instance = await initEditor(canvas, {
			initialProject: parseProjectSource(source),
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
		editor = instance;
		instance.pauseRendering();
		for (const name of ['audio', 'voices', 'envelope']) {
			const group = instance.state.codeBlockRendering.currentProject.blocks.find(block => block.name === name)!;
			instance.navigation.openGroup(getEditorBlockId(group));
		}
		await vi.dynamicImportSettled();

		const matchFrame = async (name: string) => {
			context.store.set('loadingIndicators', []);
			instance.renderFrame();
			await expect(canvas).toMatchScreenshot(name);
		};
		await matchFrame('nested-group-path');
		instance.navigation.goToParentGroup();
		await matchFrame('parent-group-path');
		instance.navigation.goToRoot();
		await matchFrame('root-project');
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
