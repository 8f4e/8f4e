import initEditor, { type Editor } from '@8f4e/editor-core';
import { createAsciiCanvasRenderer } from '@8f4e/web-ui-testing';
import { expect, test, vi } from 'vitest';

test('rejects failed source preparation before installing an atlas or drawing a frame', async () => {
	const canvas = document.createElement('canvas');
	document.body.appendChild(canvas);
	const renderer = createAsciiCanvasRenderer(canvas);
	const destroy = vi.spyOn(renderer, 'destroy');
	const installAtlas = vi.spyOn(renderer, 'setSpriteAtlas');
	const drawFrame = vi.spyOn(renderer, 'renderFrame');
	const error = new Error('source preparation failed');
	const prepare = vi.fn(async () => {
		throw error;
	});
	const cleanup = vi.fn();
	let editor: Editor | undefined;
	try {
		const mounting = initEditor(canvas, {
			renderer,
			plugins: [
				{
					id: 'broken-source-loader',
					setup: ({ events }) => {
						events.on('prepareInitialProject', prepare);
						return () => {
							events.off('prepareInitialProject', prepare);
							cleanup();
						};
					},
				},
			],
		}).then(result => {
			editor = result;
			return result;
		});
		await expect(mounting).rejects.toBe(error);
		expect(prepare).toHaveBeenCalledOnce();
		expect(installAtlas).not.toHaveBeenCalled();
		expect(drawFrame).not.toHaveBeenCalled();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(destroy).toHaveBeenCalledOnce();
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
