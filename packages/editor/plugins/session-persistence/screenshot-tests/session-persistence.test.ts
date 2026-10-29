import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor } from '@8f4e/editor-core';
import { expect, test, vi } from 'vitest';
import { createSessionPersistencePlugin } from '../src/index';

test('restores a retained project in a new editor instance', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 320;
	canvas.style.width = '640px';
	canvas.style.height = '320px';
	document.body.appendChild(canvas);
	const values = new Map<string, string>();
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
	};
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
			initialProject: parseProjectSource(
				'8f4e/v1\nconstants env\n; @pos 120 60\nconstantsEnd\nnote retained\n; @pos 3 3\nRetained across editor instances.\nnoteEnd'
			),
			initialEditorMode: 'edit',
			runtimeRegistry: {},
			plugins: [createSessionPersistencePlugin({ storage, storageKey: 'session', restoreOnStartup: true })],
		});
		expect(values.has('session')).toBe(true);
		editor.dispose();
		editor = await initEditor(canvas, {
			initialEditorMode: 'edit',
			runtimeRegistry: {},
			plugins: [createSessionPersistencePlugin({ storage, storageKey: 'session', restoreOnStartup: true })],
		});
		await vi.waitFor(() =>
			expect(
				editor!.state.codeBlockRendering.codeBlocks.some(block =>
					block.code.includes('Retained across editor instances.')
				)
			).toBe(true)
		);
		editor.pauseRendering();
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('restored-session');
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
