import initEditor, { type Editor, type EditorPluginContext } from '@8f4e/editor-core';
import { createLoadingIndicatorsPlugin } from '@8f4e/editor-plugin-loading-indicators';
import { createAsciiCanvasRenderer, readAsciiViewport } from '@8f4e/web-ui-testing';
import { expect, test, vi } from 'vitest';

test('draws contributor messages, elapsed times and terminal results with independent visibility', async () => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
	const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 320;
	canvas.style.width = '512px';
	canvas.style.height = '320px';
	document.body.append(canvas);
	let loading!: EditorPluginContext['loading'];
	let editor: Editor | undefined;
	try {
		editor = await initEditor(canvas, {
			renderer: createAsciiCanvasRenderer(canvas),
			plugins: [
				createLoadingIndicatorsPlugin({ prefersReducedMotion: () => true }),
				{
					id: 'test-contributor',
					setup: context => {
						loading = context.loading;
						return () => {};
					},
				},
			],
		});
		editor.pauseRendering();
		const download = loading.add({ id: 'download', message: 'Fetching sound...' });
		const missing = loading.add({ id: 'missing', message: 'Fetching missing sound...' });
		const plugin = loading.add({ id: 'plugin', message: 'Starting visualization...' });
		now.mockReturnValue(1240);
		vi.advanceTimersByTime(100);
		editor.renderFrame();
		await expect(readAsciiViewport(canvas)).toMatchFileSnapshot(
			'./__snapshots__/loading-indicators-pending.viewport.snap'
		);
		canvas.style.width = '192px';
		editor.resize(192, 320);
		editor.renderFrame();
		await expect(readAsciiViewport(canvas)).toMatchFileSnapshot(
			'./__snapshots__/loading-indicators-orbit-only.viewport.snap'
		);
		canvas.style.width = '512px';
		editor.resize(512, 320);
		now.mockReturnValue(1760);
		download.done();
		missing.fail();
		now.mockReturnValue(2350);
		plugin.done();
		const compilation = loading.add({ id: 'compiler', message: 'Compiling...' });
		now.mockReturnValue(2400);
		compilation.done();
		loading.add({ id: 'cancelled', message: 'Starting a superseded operation with a long message...' }).cancel();
		editor.renderFrame();
		await expect(readAsciiViewport(canvas)).toMatchFileSnapshot(
			'./__snapshots__/loading-indicators-settling.viewport.snap'
		);
		now.mockReturnValue(2900);
		await vi.advanceTimersByTimeAsync(500);
		editor.renderFrame();
		await expect(readAsciiViewport(canvas)).toMatchFileSnapshot(
			'./__snapshots__/loading-indicators-finished.viewport.snap'
		);
		now.mockReturnValue(5501);
		await vi.advanceTimersByTimeAsync(2601);
		editor.renderFrame();
		await expect(readAsciiViewport(canvas)).toMatchFileSnapshot(
			'./__snapshots__/loading-indicators-failures-retained.viewport.snap'
		);
		expect(editor.state.loadingIndicators).toHaveLength(5);
	} finally {
		editor?.dispose();
		canvas.remove();
		vi.useRealTimers();
		vi.restoreAllMocks();
	}
});
