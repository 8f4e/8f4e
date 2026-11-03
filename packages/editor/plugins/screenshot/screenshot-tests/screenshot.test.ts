import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EventDispatcher } from '@8f4e/editor-core';
import { expect, test, vi } from 'vitest';
import { createScreenshotPlugin } from '../src/index';

test('exports the rendered canvas as PNG without menus or screenshot overlays', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	canvas.style.width = '640px';
	canvas.style.height = '384px';
	document.body.appendChild(canvas);
	const project = parseProjectSource(`8f4e/v1
constants env
; @pos 120 60
constantsEnd
note screenshot
; @pos 4 3
A clean capture of this patch.
Menus and guides stay out of the image.
noteEnd
note offscreen
; @pos 120 80
This block is outside the viewport.
noteEnd`);
	let exportedBlob!: Blob;
	const write = vi.fn(async (blob: Blob) => {
		exportedBlob = blob;
	});
	const close = vi.fn().mockResolvedValue(undefined);
	const showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable: async () => ({ write, close }) });
	vi.stubGlobal('showSaveFilePicker', showSaveFilePicker);
	let editor!: Editor;
	let events!: EventDispatcher;
	const featurePlugin = createScreenshotPlugin({ canvas, renderFrame: () => editor.renderFrame() });
	let image: HTMLImageElement | undefined;
	let imageUrl: string | undefined;
	try {
		editor = await initEditor(canvas, {
			initialProject: project,
			plugins: [
				{
					...featurePlugin,
					setup: context => {
						events = context.events;
						return featurePlugin.setup(context);
					},
				},
			],
		});
		editor.state.editorMode = 'edit';
		await vi.waitFor(() =>
			expect(
				editor.state.codeBlockRendering.currentProject.blocks.some(block => block.code.includes('note screenshot'))
			).toBe(true)
		);
		editor.pauseRendering();
		const pointer = (type: string, x: number, y: number) => {
			events.dispatch(type, {
				x,
				y,
				movementX: 0,
				movementY: 0,
				altKey: false,
				buttons: type === 'pointerup' ? 0 : 1,
				stopPropagation: false,
				canvasWidth: canvas.width,
				canvasHeight: canvas.height,
			});
		};
		editor.renderFrame();
		pointer('contextmenu', 520, 16);
		await vi.waitFor(() =>
			expect(editor.state.contextMenu.items.some(item => item.action === 'exportCanvasScreenshot')).toBe(true)
		);
		editor.renderFrame();
		const menu = editor.state.contextMenu;
		const screenshotIndex = menu.items.findIndex(item => item.action === 'exportCanvasScreenshot');
		const x = menu.x - editor.state.viewport.x + 8;
		const y = menu.y - editor.state.viewport.y + screenshotIndex * editor.state.viewport.hGrid + 8;
		pointer('pointermove', x, y);
		pointer('pointerdown', x, y);
		await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
		expect(editor.state.contextMenu.open).toBe(false);
		expect(editor.state.featureFlags.canvasOverlays).toBe(true);
		expect(editor.state.featureFlags.offscreenBlockArrows).toBe(true);
		expect(showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'project.png' }));
		expect(exportedBlob.type).toBe('image/png');
		const bitmap = await createImageBitmap(exportedBlob);
		expect([bitmap.width, bitmap.height]).toEqual([640, 384]);
		bitmap.close();
		imageUrl = URL.createObjectURL(exportedBlob);
		image = document.createElement('img');
		image.src = imageUrl;
		document.body.appendChild(image);
		await image.decode();
		await expect(image).toMatchScreenshot();
	} finally {
		editor?.dispose();
		image?.remove();
		if (imageUrl) URL.revokeObjectURL(imageUrl);
		canvas.remove();
		vi.unstubAllGlobals();
	}
});
