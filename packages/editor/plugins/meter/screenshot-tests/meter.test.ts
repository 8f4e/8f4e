import initView, { createEditorRenderRegistry } from '@8f4e/web-ui';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import { setup } from '../src/__tests__/setup';
import { meterPlugin } from '../src/index';

test('meter plugin renders its directive', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const renderRegistry = createEditorRenderRegistry();
	const test = await setup(
		meterPlugin,
		[
			'module audio',
			'; @pos 4 3',
			'float low 0.1',
			'float middle 0.5',
			'float high 0.95',
			'; @meter low 0 1',
			'; @meter middle 0 1',
			'; @meter high 0 1',
			'float bipolar -0.7',
			'; @meter bipolar',
			'moduleEnd',
		],
		{ renderRegistry }
	);
	test.state.viewport.width = canvas.width;
	test.state.viewport.height = canvas.height;

	const renderer = await initView(test.store, test.events, new Engine(canvas), test.memoryViews, {
		loading: test.store.loading,
		renderRegistry,
	});

	try {
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
		canvas.remove();
	}
});
