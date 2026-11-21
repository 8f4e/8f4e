import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPluginContext } from '@8f4e/editor-core';
import { createDefaultEditorPlugins } from '@8f4e/editor-default';
import { createKeyboardNavigationPlugin } from '@8f4e/editor-plugin-keyboard-navigation';
import { Engine } from 'glugglugglug';
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
		const plugins = createDefaultEditorPlugins({
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
			renderer: new Engine(canvas),
			initialProject: parseProjectSource(
				'8f4e/v1\nconstants env\n; @pos 120 60\nconstantsEnd\nnote test\n; @pos 3 3\nhello\nworld\nnoteEnd'
			),
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
		await vi.dynamicImportSettled();
		editor.pauseRendering();
		context.store.set('loadingIndicators', []);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('view-mode-hint');
		const block = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'test')!;
		context.store.set('codeBlockRendering.selectedCodeBlock', block);
		block.cursor = { row: 3, col: 0, y: 0 };
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
		for (const value of ['Backspace', '1', 'ArrowLeft', '2', 'Escape']) {
			key(value);
			canvas.dispatchEvent(new KeyboardEvent('keyup', { key: value }));
		}
		canvas.dispatchEvent(new FocusEvent('blur'));
		await vi.waitFor(() => expect(editor!.state.editorMode).toBe('view'));
		expect(block.code[2]).toBe('hello21world');
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
			'hello21world'
		);
		const selected = editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'test')!;
		context.store.set('codeBlockRendering.selectedCodeBlock', selected);
		context.store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 2);
		context.store.set('codeBlockRendering.selectedCodeBlock.cursor.col', 5);
		expect(editor.state.editorMode).toBe('edit');
		context.store.set('loadingIndicators', []);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('edit-mode-caret');
		editor.dispose();
		editor = undefined;
		expect(key('e').defaultPrevented).toBe(false);
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});

test('raises the keyboard navigation target above an overlapping block for drawing and hit testing', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	document.body.append(canvas);
	let editor: Editor | undefined;
	let context!: EditorPluginContext;
	const drawn: string[] = [];
	const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
	try {
		editor = await initEditor(canvas, {
			renderer: new Engine(canvas),
			initialProject: parseProjectSource(`8f4e/v1
constants env
; @pos 120 60
constantsEnd
note start
; @pos 4 6
noteEnd
note target
; @pos 45 6
noteEnd
note overlap
; @pos 60 6
noteEnd`),
			plugins: [
				createKeyboardNavigationPlugin({ inputTarget: canvas }),
				{
					id: 'test-draw-order',
					setup: services => {
						context = services;
						return services.drawers.registerCodeBlockDrawer(({ codeBlock }) => {
							drawn.push(codeBlock.name);
						});
					},
				},
			],
		});
		editor.pauseRendering();
		const { viewport, codeBlockRendering } = editor.state;
		const [start, target, overlap] = ['start', 'target', 'overlap'].map(
			name => codeBlockRendering.currentProject.blocks.find(block => block.name === name)!
		);
		context.store.set('codeBlockRendering.selectedCodeBlock', start);
		drawn.length = 0;
		editor.renderFrame();
		expect(drawn).toEqual(['start', 'target', 'overlap']);

		const key = new KeyboardEvent('keydown', { key: 'ArrowRight', metaKey: true, cancelable: true });
		canvas.dispatchEvent(key);
		expect(key.defaultPrevented).toBe(true);
		expect(codeBlockRendering.selectedCodeBlock).toBe(target);
		editor.renderFrame();
		clock.mockReturnValue(2000);
		drawn.length = 0;
		editor.renderFrame();
		expect(drawn).toEqual(['start', 'overlap', 'target']);

		const hit = vi.fn();
		context.events.on('codeBlockPointerDown', hit, { capture: true });
		context.events.dispatch(
			'pointerdown',
			{
				x: overlap.x - viewport.x + 4,
				y: overlap.y - viewport.y + 4,
				movementX: 0,
				movementY: 0,
				buttons: 1,
				altKey: false,
				stopPropagation: false,
				canvasWidth: viewport.width,
				canvasHeight: viewport.height,
			},
			{ phase: 'capture' }
		);
		expect(hit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ codeBlock: target }));
	} finally {
		clock.mockRestore();
		editor?.dispose();
		canvas.remove();
	}
});
