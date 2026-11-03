import initView, { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { expect, test } from 'vitest';
import { setup } from '../src/__tests__/setup';
import { createCrossfadePlugin } from '../src/index';

test('crossfade plugin renders its directive', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const drawers = createEditorDrawerRegistry();
	const test = await setup(
		createCrossfadePlugin,
		[
			'module audio',
			'; @pos 4 3',
			'float dry 1',
			'float wet 0',
			'; @crossfade &dry &wet',
			'float centerL 0.5',
			'float centerR 0.5',
			'; @crossfade &centerL &centerR',
			'float rightL 0',
			'float rightR 1',
			'; @crossfade &rightL &rightR',
			'moduleEnd',
		],
		{ drawers }
	);
	test.state.viewport.width = canvas.width;
	test.state.viewport.height = canvas.height;

	const renderer = await initView(test.store, test.events, canvas, test.memoryViews, { drawers });

	try {
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
		canvas.remove();
	}
});
