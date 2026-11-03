import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPluginContext } from '@8f4e/editor-core';
import { createDefaultEditorPlugins } from '@8f4e/editor-default';
import { expect, test, vi } from 'vitest';

test('coordinates independent keyboard plugins across cold editing, navigation, history and mode changes', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	document.body.append(canvas);
	let editor: Editor | undefined;
	let context!: EditorPluginContext;
	const values = new Map<string, string>();
	const pressed = new Set<string>();
	try {
		const plugins = await createDefaultEditorPlugins({
			canvas,
			storage: {
				getItem: (key: string) => values.get(key) ?? null,
				setItem: (key: string, value: string) => {
					values.set(key, value);
				},
			} as Storage,
			storageKey: 'keyboard-test',
			showOpenMenuItem: false,
			renderFrame: () => editor!.renderFrame(),
			getMemory: () => null,
			writeMemory: () => {},
			getCodeBuffer: () => new Uint8Array(),
			getAssertionSites: () => undefined,
		});
		editor = await initEditor(canvas, {
			initialProject: parseProjectSource('8f4e/v1\nnote test\n; @pos 3 3\nhello\nnoteEnd'),
			featureFlags: { historyTracking: true },
			plugins: [
				...plugins,
				{
					id: 'test-context',
					setup: services => {
						context = services;
						const onDown = (event: KeyboardEvent) => {
							pressed.add(event.key);
						};
						const onUp = (event: KeyboardEvent) => {
							pressed.delete(event.key);
						};
						const onBlur = () => pressed.clear();
						canvas.addEventListener('keydown', onDown);
						canvas.addEventListener('keyup', onUp);
						canvas.addEventListener('blur', onBlur);
						return () => {
							canvas.removeEventListener('keydown', onDown);
							canvas.removeEventListener('keyup', onUp);
							canvas.removeEventListener('blur', onBlur);
						};
					},
				},
			],
		});
		const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'test')!;
		context.store.set('codeBlockRendering.selectedCodeBlock', block);
		block.cursor = { row: 2, col: 5, x: 0, y: 0 };
		const key = (key: string, modifiers: KeyboardEventInit = {}) => {
			const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true, ...modifiers });
			canvas.dispatchEvent(event);
			return event;
		};
		expect(editor.state.editorMode).toBe('view');
		expect(key('z', { ctrlKey: true }).defaultPrevented).toBe(false);
		expect(key('e').defaultPrevented).toBe(true);
		// These inputs arrive before the first editing import can finish.
		canvas.dispatchEvent(new KeyboardEvent('keyup', { key: 'e' }));
		for (const value of ['1', 'ArrowLeft', '2', 'Escape']) {
			key(value);
			canvas.dispatchEvent(new KeyboardEvent('keyup', { key: value }));
		}
		canvas.dispatchEvent(new FocusEvent('blur'));
		await vi.waitFor(() => expect(editor!.state.editorMode).toBe('view'));
		expect(block.code[2]).toBe('hello21');
		expect(pressed.size).toBe(0);
		expect(key('z', { ctrlKey: true }).defaultPrevented).toBe(false);
		expect(key('ArrowLeft').defaultPrevented).toBe(false);
		expect(key('ArrowUp').defaultPrevented).toBe(true);
		expect(block.cursor.row).toBe(1);
		key('e');
		key('z', { ctrlKey: true });
		expect(editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'test')!.code).toContain(
			'hello'
		);
		key('y', { ctrlKey: true });
		expect(editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'test')!.code).toContain(
			'hello21'
		);
		editor.dispose();
		editor = undefined;
		expect(key('e').defaultPrevented).toBe(false);
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
