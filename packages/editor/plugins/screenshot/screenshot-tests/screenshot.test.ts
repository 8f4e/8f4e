import initEditor, { type Editor, type EventDispatcher } from '@8f4e/editor-core';
import { PALETTE_INDICES, type PaletteToken, resolvePalette } from '@8f4e/editor-palette';
import { Engine } from 'glugglugglug';
import { expect, test, vi } from 'vitest';
import { createScreenshotPlugin } from '../src/index';

test('exports the rendered canvas as PNG without menus or screenshot overlays', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	canvas.style.width = '640px';
	canvas.style.height = '384px';
	document.body.appendChild(canvas);
	const palette = resolvePalette();
	const rgba = (token: PaletteToken) => palette.rgba[token].map(value => Math.round(value * 255));
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
		const renderer = new Engine(canvas);
		const { gl } = renderer;
		const readLivePixel = (x: number, y: number) => {
			const pixel = new Uint8Array(4);
			gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
			return [...pixel];
		};
		editor = await initEditor(canvas, {
			renderer,
			plugins: [
				{
					id: 'fixture-rendering',
					setup: ({ events: dispatcher, renderRegistry }) => {
						events = dispatcher;
						const removeContent = renderRegistry.registerCanvasBackgroundDrawer(({ draw }) => {
							draw.drawFill(32, 32, PALETTE_INDICES.primaryBase, 160, 64);
						});
						const removeOverlay = renderRegistry.registerCanvasOverlay(({ draw }) => {
							draw.drawFill(32, 112, PALETTE_INDICES.positiveBase, 96, 48);
						});
						const removeMenu = renderRegistry.registerContextMenuOverlay(({ draw, state }) => {
							if (state.contextMenu.open) draw.drawFill(520, 16, PALETTE_INDICES.negativeBase, 80, 80);
						});
						return () => {
							removeMenu();
							removeOverlay();
							removeContent();
						};
					},
				},
				featurePlugin,
			],
		});
		editor.state.editorMode = 'edit';
		editor.pauseRendering();
		events.dispatch('contextmenu', {
			x: 520,
			y: 16,
			movementX: 0,
			movementY: 0,
			altKey: false,
			buttons: 1,
			stopPropagation: false,
			canvasWidth: canvas.width,
			canvasHeight: canvas.height,
		});
		await vi.waitFor(() =>
			expect(editor.state.contextMenu.items.some(item => item.action === 'exportCanvasScreenshot')).toBe(true)
		);
		editor.renderFrame();
		expect(readLivePixel(48, 48)).toEqual(rgba('primaryBase'));
		expect(readLivePixel(48, 128)).toEqual(rgba('positiveBase'));
		expect(readLivePixel(536, 32)).toEqual(rgba('negativeBase'));
		const menu = editor.state.contextMenu;
		const screenshotIndex = menu.items.findIndex(item => item.action === 'exportCanvasScreenshot');
		events.dispatch('activateContextMenuItem', { index: screenshotIndex, x: 520, y: 16 });
		await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
		expect(editor.state.contextMenu.open).toBe(false);
		expect(editor.state.featureFlags.canvasOverlays).toBe(true);
		expect(showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'project.png' }));
		expect(exportedBlob.type).toBe('image/png');
		imageUrl = URL.createObjectURL(exportedBlob);
		image = document.createElement('img');
		image.src = imageUrl;
		document.body.appendChild(image);
		await image.decode();
		expect([image.naturalWidth, image.naturalHeight]).toEqual([640, 384]);
		const decoded = document.createElement('canvas');
		decoded.width = image.naturalWidth;
		decoded.height = image.naturalHeight;
		const context = decoded.getContext('2d')!;
		context.drawImage(image, 0, 0);
		const readExportedPixel = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data];
		expect(readExportedPixel(48, 48)).toEqual(rgba('primaryBase'));
		expect(readExportedPixel(48, 128)).toEqual([0, 0, 0, 0]);
		expect(readExportedPixel(536, 32)).toEqual([0, 0, 0, 0]);
		await expect(image).toMatchScreenshot();
	} finally {
		editor?.dispose();
		image?.remove();
		if (imageUrl) URL.revokeObjectURL(imageUrl);
		canvas.remove();
		vi.unstubAllGlobals();
	}
});
